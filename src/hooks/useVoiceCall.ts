import { useCallback, useRef, useState } from 'react'

// ─── VAD tuning constants ─────────────────────────────────────────────────────
const SILENCE_THRESHOLD = 0.007    // RMS below this → silence
const SPEECH_THRESHOLD = 0.013     // RMS above this → user speaking
const INTERRUPT_THRESHOLD = 0.022  // RMS above this → interrupt while AI talks
const SILENCE_DURATION_MS = 1500   // 1.5 s of silence = done speaking
const MIN_SPEECH_DURATION_MS = 400 // ignore blips shorter than this
const VAD_INTERVAL_MS = 50         // check audio level every 50 ms

// ─── Types ────────────────────────────────────────────────────────────────────
export type CallPhase =
  | 'idle'       // call not started
  | 'waiting'    // listening for user to start speaking
  | 'recording'  // user is actively speaking
  | 'processing' // audio sent for STT+AI, VAD locked
  | 'ai_speaking'// AI is talking (VAD watching for interrupt)

type InternalPhase = 'stopped' | 'waiting' | 'recording' | 'locked' | 'ai_speaking'

interface UseVoiceCallOptions {
  /** Called with the recorded audio blob when user finishes speaking */
  onSpeechReady: (blob: Blob) => void
  /** Called immediately when user speaks over the AI */
  onInterrupt: () => void
}

interface UseVoiceCallReturn {
  callPhase: CallPhase
  audioLevel: number   // live RMS 0–~0.1, for waveform viz
  error: string | null
  startCall: () => Promise<void>
  endCall: () => void
  notifyAISpeaking: () => void  // App calls this when TTS starts playing
  notifyAIStopped: () => void   // App calls this when TTS ends naturally
}

export function useVoiceCall({ onSpeechReady, onInterrupt }: UseVoiceCallOptions): UseVoiceCallReturn {
  const [callPhase, setCallPhase] = useState<CallPhase>('idle')
  const [audioLevel, setAudioLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // All mutable values accessed inside the setInterval callback must be refs
  // to avoid stale closure issues
  const phaseRef = useRef<InternalPhase>('stopped')
  const streamRef = useRef<MediaStream | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const bufferRef = useRef<Float32Array | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const shouldProcessRef = useRef(false)
  const speechStartRef = useRef<number | null>(null)
  const silenceStartRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Always-fresh callback refs (hook consumers update these every render)
  const onSpeechReadyRef = useRef(onSpeechReady)
  onSpeechReadyRef.current = onSpeechReady
  const onInterruptRef = useRef(onInterrupt)
  onInterruptRef.current = onInterrupt

  // ─── Recorder helpers ─────────────────────────────────────────────────────
  const haltRecorder = useCallback((process: boolean) => {
    shouldProcessRef.current = process
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') {
      rec.stop()
    } else {
      chunksRef.current = []
    }
    recorderRef.current = null
  }, [])

  const beginRecorder = useCallback(() => {
    const stream = streamRef.current
    if (!stream) return
    chunksRef.current = []

    const mime =
      ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
        .find(t => MediaRecorder.isTypeSupported(t)) ?? ''

    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {})

    rec.ondataavailable = e => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    rec.onstop = () => {
      if (shouldProcessRef.current) {
        shouldProcessRef.current = false
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        chunksRef.current = []
        if (blob.size > 1000) onSpeechReadyRef.current(blob)
      } else {
        chunksRef.current = []
      }
    }

    rec.start(100)
    recorderRef.current = rec
  }, [])

  // ─── VAD tick (runs every VAD_INTERVAL_MS via setInterval) ───────────────
  // Only accesses refs to avoid stale closures — never closes over React state
  const vadTick = useCallback(() => {
    const analyser = analyserRef.current
    const buf = bufferRef.current
    if (!analyser || !buf) return

    analyser.getFloatTimeDomainData(buf)
    let sum = 0
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
    const rms = Math.sqrt(sum / buf.length)
    setAudioLevel(rms)

    const now = Date.now()
    const p = phaseRef.current

    if (p === 'waiting') {
      if (rms > SPEECH_THRESHOLD) {
        // User started speaking → begin recording
        phaseRef.current = 'recording'
        setCallPhase('recording')
        speechStartRef.current = now
        silenceStartRef.current = null
        beginRecorder()
      }
    } else if (p === 'recording') {
      if (rms < SILENCE_THRESHOLD) {
        // Potential end of speech
        if (!silenceStartRef.current) {
          silenceStartRef.current = now
        } else if (now - silenceStartRef.current >= SILENCE_DURATION_MS) {
          // Silence confirmed — user done
          const speechDuration = now - (speechStartRef.current ?? now)
          speechStartRef.current = null
          silenceStartRef.current = null

          if (speechDuration >= MIN_SPEECH_DURATION_MS) {
            phaseRef.current = 'locked'
            setCallPhase('processing')
            haltRecorder(true)  // → triggers onSpeechReady
          } else {
            // Too short (cough, breath) — go back to listening
            phaseRef.current = 'waiting'
            setCallPhase('waiting')
            haltRecorder(false)
          }
        }
      } else {
        silenceStartRef.current = null // still speaking, reset timer
      }
    } else if (p === 'ai_speaking') {
      if (rms > INTERRUPT_THRESHOLD) {
        // User interrupted AI — start recording immediately
        phaseRef.current = 'recording'
        setCallPhase('recording')
        speechStartRef.current = now
        silenceStartRef.current = null
        beginRecorder()
        onInterruptRef.current()
      }
    }
  }, [beginRecorder, haltRecorder])

  // ─── Public API ───────────────────────────────────────────────────────────
  const startCall = useCallback(async () => {
    setError(null)
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    })
    streamRef.current = stream

    const ctx = new AudioContext()
    ctxRef.current = ctx
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    source.connect(analyser)
    analyserRef.current = analyser
    bufferRef.current = new Float32Array(analyser.fftSize)

    phaseRef.current = 'waiting'
    setCallPhase('waiting')
    intervalRef.current = setInterval(vadTick, VAD_INTERVAL_MS)
  }, [vadTick])

  const endCall = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    haltRecorder(false)
    ctxRef.current?.close().catch(() => {})
    ctxRef.current = null
    analyserRef.current = null
    bufferRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    phaseRef.current = 'stopped'
    setCallPhase('idle')
    setAudioLevel(0)
    speechStartRef.current = null
    silenceStartRef.current = null
  }, [haltRecorder])

  // Called by App right after TTS audio starts playing
  const notifyAISpeaking = useCallback(() => {
    if (phaseRef.current === 'stopped') return
    phaseRef.current = 'ai_speaking'
    setCallPhase('ai_speaking')
    speechStartRef.current = null
    silenceStartRef.current = null
  }, [])

  // Called by App when TTS finishes naturally — resumes listening
  const notifyAIStopped = useCallback(() => {
    if (phaseRef.current === 'stopped') return // call was ended, ignore
    phaseRef.current = 'waiting'
    setCallPhase('waiting')
    speechStartRef.current = null
    silenceStartRef.current = null
  }, [])

  return { callPhase, audioLevel, error, startCall, endCall, notifyAISpeaking, notifyAIStopped }
}
