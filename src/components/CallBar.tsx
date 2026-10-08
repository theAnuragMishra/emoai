import { CallPhase } from '../hooks/useVoiceCall'

interface CallBarProps {
  callPhase: CallPhase
  audioLevel: number   // live RMS value 0–~0.1
  friendName: string
  onEndCall: () => void
}

const NUM_BARS = 9

function getBarHeight(audioLevel: number, barIndex: number, phase: CallPhase): number {
  const BASE = 4
  const MAX = 32
  const center = (NUM_BARS - 1) / 2
  const distFromCenter = Math.abs(barIndex - center) / center // 0 at center, 1 at edges
  const shape = 1 - distFromCenter * 0.5 // center bars taller

  if (phase === 'recording') {
    const norm = Math.min(audioLevel / 0.06, 1)
    return BASE + norm * MAX * shape
  }
  // For other phases: CSS animation handles it; return base height
  return BASE + MAX * 0.18 * shape
}

const PHASE_LABELS: Record<CallPhase, string> = {
  idle: '',
  waiting: 'Listening…',
  recording: "You're talking",
  processing: 'Transcribing…',
  ai_speaking: 'Talking…',
}

const PHASE_COLORS: Record<CallPhase, string> = {
  idle: 'bg-zinc-400',
  waiting: 'bg-zinc-500',
  recording: 'bg-violet-400',
  processing: 'bg-amber-400',
  ai_speaking: 'bg-indigo-400',
}

export function CallBar({ callPhase, audioLevel, friendName, onEndCall }: CallBarProps) {
  const label = PHASE_LABELS[callPhase]
  const barColor = PHASE_COLORS[callPhase]
  const isAISpeaking = callPhase === 'ai_speaking'
  const isRecording = callPhase === 'recording'
  const isWaiting = callPhase === 'waiting'

  return (
    <div className="flex flex-col items-center gap-3 py-5 animate-fade-in">
      {/* Friend avatar with pulsing ring */}
      <div className="relative flex items-center justify-center">
        {(isWaiting || isRecording) && (
          <>
            <span className={`absolute w-20 h-20 rounded-full opacity-20 animate-pulse-ring ${isRecording ? 'bg-violet-500' : 'bg-zinc-500'}`} />
            <span className={`absolute w-20 h-20 rounded-full opacity-10 animate-pulse-ring [animation-delay:0.5s] ${isRecording ? 'bg-violet-500' : 'bg-zinc-500'}`} />
          </>
        )}
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xl font-bold shadow-lg z-10">
          {friendName.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* Status label */}
      <div className="flex items-center gap-2 h-5">
        {callPhase === 'processing' || callPhase === 'waiting' ? (
          <span className="text-xs text-zinc-400">
            {callPhase === 'waiting'
              ? `${friendName} is listening`
              : 'Processing…'}
          </span>
        ) : callPhase === 'ai_speaking' ? (
          <span className="text-xs text-indigo-300">{friendName} is {label}</span>
        ) : callPhase === 'recording' ? (
          <span className="text-xs text-violet-300">{label}</span>
        ) : null}
      </div>

      {/* Live waveform bars */}
      <div className="flex items-end gap-[3px] h-10">
        {Array.from({ length: NUM_BARS }, (_, i) => {
          const h = getBarHeight(audioLevel, i, callPhase)
          return (
            <span
              key={i}
              className={`w-[5px] rounded-full transition-all ${
                isAISpeaking ? 'wave-bar' : barColor
              }`}
              style={{
                height: isAISpeaking ? undefined : `${h}px`,
                ...(isAISpeaking
                  ? { animationDelay: `${(i / NUM_BARS) * 0.8}s`, color: 'rgb(129,140,248)' }
                  : {}),
              }}
            />
          )
        })}
      </div>

      {/* Hint text */}
      {isAISpeaking && (
        <p className="text-[10px] text-zinc-600 -mt-1">Speak to interrupt</p>
      )}
      {isWaiting && (
        <p className="text-[10px] text-zinc-600 -mt-1">Start talking anytime</p>
      )}

      {/* Hang up button */}
      <button
        onClick={onEndCall}
        title="End call"
        className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-400 active:scale-95 flex items-center justify-center shadow-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
      >
        <PhoneOffIcon />
      </button>
    </div>
  )
}

function PhoneOffIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07"/>
      <path d="M14.5 2A19.79 19.79 0 0 0 3.07 5.5 2 2 0 0 0 2 7.72v3a2 2 0 0 0 1.72 2 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 .45 2.11L5.71 16.5"/>
      <line x1="2" y1="2" x2="22" y2="22"/>
    </svg>
  )
}
