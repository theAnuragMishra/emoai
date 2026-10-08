import { AppStatus } from '../types'

interface StatusBannerProps {
  status: AppStatus
  friendName: string
  error: string | null
  onDismissError: () => void
}

const STATUS_MESSAGES: Record<AppStatus, string | null> = {
  idle: null,
  recording: '🎙️ Listening...',
  transcribing: '✍️ Transcribing...',
  thinking: '💭 Thinking...',
  speaking: '🔊 Playing response...',
}

export function StatusBanner({ status, friendName, error, onDismissError }: StatusBannerProps) {
  if (error) {
    return (
      <div className="flex items-center justify-between gap-2 px-4 py-2 bg-red-900/40 border border-red-800/50 rounded-xl text-xs text-red-300 animate-fade-in">
        <span className="flex-1 min-w-0 truncate">⚠️ {error}</span>
        <button
          onClick={onDismissError}
          className="shrink-0 text-red-400 hover:text-red-200 transition-colors"
          aria-label="Dismiss error"
        >
          ✕
        </button>
      </div>
    )
  }

  const msg = STATUS_MESSAGES[status]
  if (!msg) return null

  return (
    <div className="flex items-center justify-center gap-2 py-1.5 animate-fade-in">
      <span className="text-xs text-zinc-400">{msg.replace('...', '')}</span>
      <span className="flex items-end h-3 gap-px">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="wave-bar text-violet-400"
            style={{ height: '8px', animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
    </div>
  )
}

interface SetupBannerProps {
  friendName: string
  onOpenSettings: () => void
}

export function SetupBanner({ friendName, onOpenSettings }: SetupBannerProps) {
  return (
    <div className="mx-4 mt-4 p-4 bg-violet-900/30 border border-violet-700/40 rounded-2xl animate-fade-in">
      <p className="text-sm text-violet-200 font-medium mb-1">
        Hey! I'm <span className="text-violet-300 font-bold">{friendName}</span> 👋
      </p>
      <p className="text-xs text-violet-300/70 mb-3">
        Before we vibe — I need your API keys to get started. Takes 2 secs.
      </p>
      <button
        onClick={onOpenSettings}
        className="text-xs bg-violet-600 hover:bg-violet-500 text-white px-4 py-1.5 rounded-lg transition-colors font-medium"
      >
        Set up API keys →
      </button>
    </div>
  )
}
