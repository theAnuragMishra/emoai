import { useState, useRef, useCallback, useEffect } from 'react'
import { Message, AppStatus } from './types'
import { useSettings } from './hooks/useSettings'
import { useGemini } from './hooks/useGemini'
import { useElevenLabs } from './hooks/useElevenLabs'
import { useVoiceRecorder } from './hooks/useVoiceRecorder'
import { useVoiceCall } from './hooks/useVoiceCall'
import { ChatBubble } from './components/ChatBubble'
import { MicButton } from './components/MicButton'
import { TextInput } from './components/TextInput'
import { SettingsPanel } from './components/SettingsPanel'
import { StatusBanner, SetupBanner } from './components/StatusBanner'
import { CallBar } from './components/CallBar'

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function App() {
  // ─── Settings ──────────────────────────────────────────────────────────────
  const { settings, updateSettings, isOpen: settingsOpen, openSettings, closeSettings, isConfigured } =
    useSettings()

  // ─── AI + Voice hooks ─────────────────────────────────────────────────────
  const { sendMessage } = useGemini()
  const { transcribeAudio, speakText, stopSpeaking } = useElevenLabs()
  const { recorderState, startRecording, stopRecording, error: micError } = useVoiceRecorder()

  // ─── App state ────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([])
  const [status, setStatus] = useState<AppStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const messagesRef = useRef<Message[]>([])       // always-fresh snapshot for async handlers
  const isProcessingRef = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Keep messagesRef in sync with state
  useEffect(() => { messagesRef.current = messages }, [messages])

  // ─── Call mode — forward refs so callbacks always see latest values ───────
  // We can't pass functions that close over voiceCall (defined below) before
  // voiceCall is defined, so we use stable forwarder refs.
  const speechReadyCbRef = useRef<(blob: Blob) => void>(() => {})
  const interruptCbRef = useRef<() => void>(() => {})

  const voiceCall = useVoiceCall({
    onSpeechReady: useCallback((blob) => speechReadyCbRef.current(blob), []),
    onInterrupt:   useCallback(() => interruptCbRef.current(), []),
  })

  // ─── Shared: run full pipeline on transcribed text ─────────────────────────
  // Used by both manual mode and call mode.
  // history is captured BEFORE adding the user message so Gemini sees the right context.
  const runPipeline = useCallback(async (
    text: string,
    isVoice: boolean,
    onAIStartedSpeaking?: () => void,
    onPipelineDone?: () => void,
  ) => {
    if (isProcessingRef.current) return
    isProcessingRef.current = true

    const historySnapshot = messagesRef.current
    const userMsg: Message = { id: generateId(), role: 'user', content: text, timestamp: new Date(), isVoice }
    setMessages(prev => [...prev, userMsg])
    setError(null)
    setStatus('thinking')

    try {
      const reply = await sendMessage(text, historySnapshot, settings)

      const aiMsg: Message = { id: generateId(), role: 'assistant', content: reply, timestamp: new Date(), isVoice: true }
      setMessages(prev => [...prev, aiMsg])
      setStatus('speaking')

      await speakText(reply, settings, () => {
        // TTS ended naturally
        isProcessingRef.current = false
        setStatus('idle')
        onPipelineDone?.()
      })

      // speakText resolves when audio.play() starts — notify now that AI is audibly speaking
      onAIStartedSpeaking?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setError(msg)
      isProcessingRef.current = false
      setStatus('idle')
      onPipelineDone?.()
    }
  }, [settings, sendMessage, speakText])

  // ─── Call mode handlers (assigned to refs so voiceCall hook always calls latest) ─
  speechReadyCbRef.current = async (blob: Blob) => {
    if (isProcessingRef.current) return
    setStatus('transcribing')
    setError(null)

    let text: string
    try {
      text = await transcribeAudio(blob, settings)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed')
      isProcessingRef.current = false
      setStatus('idle')
      voiceCall.notifyAIStopped()   // resume listening even on error
      return
    }

    if (!text.trim()) {
      setError("Didn't catch that — try again?")
      isProcessingRef.current = false
      setStatus('idle')
      voiceCall.notifyAIStopped()
      return
    }

    await runPipeline(
      text,
      true,
      () => voiceCall.notifyAISpeaking(),  // called when audio actually starts
      () => voiceCall.notifyAIStopped(),   // called when TTS finishes naturally
    )
  }

  interruptCbRef.current = () => {
    // User spoke over AI — stop playback immediately
    stopSpeaking()
    isProcessingRef.current = false
    setStatus('recording')
    // VAD is already recording the user's new speech
  }

  // ─── Start / End call ─────────────────────────────────────────────────────
  const handleStartCall = useCallback(async () => {
    if (!isConfigured) { openSettings(); return }
    if (status !== 'idle') return
    setError(null)
    try {
      await voiceCall.startCall()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone access denied')
    }
  }, [isConfigured, openSettings, status, voiceCall])

  const handleEndCall = useCallback(() => {
    voiceCall.endCall()
    stopSpeaking()
    isProcessingRef.current = false
    setStatus('idle')
  }, [voiceCall, stopSpeaking])

  // ─── Manual mic handler (non-call mode) ───────────────────────────────────
  const handleMicPress = useCallback(async () => {
    if (!isConfigured) { openSettings(); return }
    if (status === 'speaking') { stopSpeaking(); setStatus('idle'); isProcessingRef.current = false; return }

    if (recorderState === 'idle') {
      try {
        await startRecording()
        setStatus('recording')
        setError(null)
      } catch { setStatus('idle') }
    } else {
      setStatus('transcribing')
      const blob = await stopRecording()
      if (!blob || blob.size < 1000) {
        setError("Didn't catch that — hold the mic and speak, then tap again.")
        setStatus('idle')
        isProcessingRef.current = false
        return
      }
      try {
        const text = await transcribeAudio(blob, settings)
        if (text.trim()) {
          await runPipeline(text, true)
        } else {
          setError("Couldn't make that out — try again?")
          setStatus('idle')
          isProcessingRef.current = false
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Transcription failed')
        setStatus('idle')
        isProcessingRef.current = false
      }
    }
  }, [
    isConfigured, openSettings, status, recorderState,
    stopSpeaking, startRecording, stopRecording,
    transcribeAudio, settings, runPipeline,
  ])

  // ─── Text send handler ────────────────────────────────────────────────────
  const handleTextSend = useCallback((text: string) => {
    if (!isConfigured) { openSettings(); return }
    runPipeline(text, false)
  }, [isConfigured, openSettings, runPipeline])

  // ─── Misc ─────────────────────────────────────────────────────────────────
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, status])
  useEffect(() => { if (micError) setError(micError) }, [micError])
  useEffect(() => { if (voiceCall.error) setError(voiceCall.error) }, [voiceCall.error])

  const handleClearChat = () => {
    if (status !== 'idle') return
    stopSpeaking()
    setMessages([])
    setError(null)
  }

  const callActive = voiceCall.callPhase !== 'idle'
  const isBusy = status !== 'idle'

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full w-4/5 mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/60 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-sm font-bold shadow">
              {settings.friendName.charAt(0).toUpperCase()}
            </div>
            {/* Call active indicator */}
            {callActive && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-zinc-950 animate-pulse" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-100 leading-tight">{settings.friendName}</p>
            <p className="text-[11px] leading-tight flex items-center gap-1.5">
              {callActive ? (
                <span className="text-emerald-400 font-medium">● In call</span>
              ) : (
                <>
                  <span className={`w-1.5 h-1.5 rounded-full ${isBusy ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  <span className="text-zinc-500">{isBusy ? 'Busy…' : 'Online'}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {messages.length > 0 && !isBusy && !callActive && (
            <button onClick={handleClearChat} title="Clear chat"
              className="p-2 rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all">
              <TrashIcon />
            </button>
          )}
          <button onClick={openSettings} title="Settings"
            className="p-2 rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all">
            <SettingsIcon />
          </button>
        </div>
      </header>

      {/* Setup banner */}
      {!isConfigured && <SetupBanner friendName={settings.friendName} onOpenSettings={openSettings} />}

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {messages.length === 0 && isConfigured && !callActive && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-2xl font-bold shadow-lg">
              {settings.friendName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-semibold text-zinc-200">Yo, what's up? 👋</p>
              <p className="text-sm text-zinc-500 mt-1">
                Tap 📞 for a hands-free voice call, or use the mic / type below
              </p>
            </div>
          </div>
        )}

        {messages.map(msg => (
          <ChatBubble key={msg.id} message={msg} friendName={settings.friendName} />
        ))}

        {/* Typing indicator */}
        {status === 'thinking' && (
          <div className="flex items-end gap-2 animate-fade-in">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
              {settings.friendName.charAt(0).toUpperCase()}
            </div>
            <div className="bg-zinc-800 px-4 py-3 rounded-2xl rounded-bl-sm">
              <span className="flex items-end h-4 gap-px">
                {[0, 1, 2, 3, 4].map(i => (
                  <span key={i} className="wave-bar text-zinc-400"
                    style={{ height: '10px', animationDelay: `${i * 0.1}s` }} />
                ))}
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Bottom panel */}
      <div className="shrink-0 border-t border-zinc-800/60 px-4 pt-3 pb-6 bg-zinc-950/80 backdrop-blur-sm">
        {/* Status / Error */}
        <div className="mb-3">
          <StatusBanner
            status={status}
            friendName={settings.friendName}
            error={error}
            onDismissError={() => setError(null)}
          />
        </div>

        {callActive ? (
          /* ── CALL MODE UI ── */
          <CallBar
            callPhase={voiceCall.callPhase}
            audioLevel={voiceCall.audioLevel}
            friendName={settings.friendName}
            onEndCall={handleEndCall}
          />
        ) : (
          /* ── NORMAL MODE UI ── */
          <>
            <div className="flex items-end gap-3">
              {/* Mic button (manual mode) */}
              <MicButton
                status={status}
                onPress={handleMicPress}
                disabled={!isConfigured || callActive}
              />

              {/* Text input */}
              <div className="flex-1">
                <TextInput
                  onSend={handleTextSend}
                  status={status}
                  disabled={!isConfigured || callActive}
                />
              </div>

              {/* Start call button */}
              <button
                onClick={handleStartCall}
                disabled={isBusy || !isConfigured}
                title={isConfigured ? 'Start voice call' : 'Add API keys first'}
                className={`
                  shrink-0 w-11 h-11 rounded-full flex items-center justify-center
                  transition-all duration-150 active:scale-95 shadow
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500
                  ${isBusy || !isConfigured
                    ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'}
                `}
              >
                <PhoneIcon />
              </button>
            </div>

            <p className="text-center text-[10px] text-zinc-700 mt-2.5">
              {status === 'recording' ? 'Tap mic again to send'
               : status === 'speaking' ? 'Tap mic to stop'
               : '📞 call for hands-free • mic for manual • or type'}
            </p>
          </>
        )}
      </div>

      {/* Settings modal */}
      {settingsOpen && (
        <SettingsPanel settings={settings} onSave={updateSettings} onClose={closeSettings} />
      )}
    </div>
  )
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.64 3.18 2 2 0 0 1 3.64 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  )
}

export default App
