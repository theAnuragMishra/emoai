import { Message } from '../types'

interface ChatBubbleProps {
  message: Message
  friendName: string
}

export function ChatBubble({ message, friendName }: ChatBubbleProps) {
  const isUser = message.role === 'user'
  const timeStr = message.timestamp.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div
      className={`flex items-end gap-2 animate-slide-up ${
        isUser ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs font-bold shrink-0 mb-1">
          {friendName.charAt(0).toUpperCase()}
        </div>
      )}

      <div
        className={`flex flex-col gap-1 max-w-[78%] ${
          isUser ? 'items-end' : 'items-start'
        }`}
      >
        {/* Bubble */}
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isUser
              ? 'bg-violet-600 text-white rounded-br-sm'
              : 'bg-zinc-800 text-zinc-100 rounded-bl-sm'
          }`}
        >
          {message.content}
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-1.5 px-1">
          {message.isVoice && (
            <span className="text-[10px] text-zinc-500">
              {isUser ? '🎤' : '🔊'}
            </span>
          )}
          <span className="text-[10px] text-zinc-600">{timeStr}</span>
        </div>
      </div>
    </div>
  )
}
