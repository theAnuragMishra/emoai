import { useState, KeyboardEvent, useRef, useEffect } from 'react'
import { AppStatus } from '../types'

interface TextInputProps {
  onSend: (text: string) => void
  status: AppStatus
  disabled?: boolean
}

export function TextInput({ onSend, status, disabled }: TextInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isBusy = status !== 'idle'

  // Auto-grow textarea height
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [value])

  const handleSend = () => {
    const text = value.trim()
    if (!text || isBusy || disabled) return
    onSend(text)
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const placeholder =
    status === 'recording'
      ? 'Recording...'
      : status === 'transcribing'
      ? 'Transcribing...'
      : status === 'thinking'
      ? 'Thinking...'
      : status === 'speaking'
      ? 'Playing response...'
      : 'Type a message…'

  return (
    <div className="flex items-end gap-2 bg-zinc-800 rounded-2xl px-4 py-3 border border-zinc-700/50 transition-all focus-within:border-violet-500/50">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isBusy || disabled}
        rows={1}
        className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 resize-none outline-none leading-relaxed disabled:opacity-40"
      />
      <button
        onClick={handleSend}
        disabled={!value.trim() || isBusy || disabled}
        aria-label="Send message"
        className={`
          shrink-0 w-8 h-8 rounded-full flex items-center justify-center
          transition-all duration-150 active:scale-90
          focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500
          ${
            value.trim() && !isBusy && !disabled
              ? 'bg-violet-600 hover:bg-violet-500 text-white'
              : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
          }
        `}
      >
        <SendIcon />
      </button>
    </div>
  )
}

function SendIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  )
}
