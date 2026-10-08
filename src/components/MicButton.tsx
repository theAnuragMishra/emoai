import { AppStatus } from '../types'

interface MicButtonProps {
  status: AppStatus
  onPress: () => void
  disabled?: boolean
}

export function MicButton({ status, onPress, disabled }: MicButtonProps) {
  const isRecording = status === 'recording'
  const isBusy =
    status === 'transcribing' || status === 'thinking' || status === 'speaking'

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer pulse rings when recording */}
      {isRecording && (
        <>
          <span className="absolute inline-flex h-20 w-20 rounded-full bg-red-500/20 animate-pulse-ring" />
          <span
            className="absolute inline-flex h-20 w-20 rounded-full bg-red-500/10 animate-pulse-ring"
            style={{ animationDelay: '0.5s' }}
          />
        </>
      )}

      <button
        onClick={onPress}
        disabled={disabled || isBusy}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        className={`
          relative z-10 w-16 h-16 rounded-full
          flex items-center justify-center
          transition-all duration-200 ease-out
          shadow-lg active:scale-95
          focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500
          ${
            isBusy
              ? 'bg-zinc-700 cursor-not-allowed opacity-50'
              : isRecording
              ? 'bg-red-500 hover:bg-red-400 scale-105'
              : 'bg-violet-600 hover:bg-violet-500'
          }
        `}
      >
        {isBusy ? (
          /* Waveform animation during busy states */
          <span className="flex items-end h-5 gap-px">
            {[0, 1, 2, 3, 4].map(i => (
              <span
                key={i}
                className="wave-bar h-3"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </span>
        ) : isRecording ? (
          /* Stop square icon */
          <span className="w-5 h-5 rounded-sm bg-white" />
        ) : (
          /* Mic icon */
          <MicIcon />
        )}
      </button>
    </div>
  )
}

function MicIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-white"
    >
      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
      <line x1="8" x2="16" y1="22" y2="22" />
    </svg>
  )
}
