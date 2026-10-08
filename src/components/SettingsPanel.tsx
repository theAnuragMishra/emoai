import { useState, useEffect } from 'react'
import { Settings, DEFAULT_SETTINGS } from '../types'

interface SettingsPanelProps {
  settings: Settings
  onSave: (partial: Partial<Settings>) => void
  onClose: () => void
}

const GEMINI_MODELS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'gemini-3.5-flash', label: 'Gemini 3.5 flash' },
  { value: 'gemini-3.5-pro', label: 'Gemini 3.5 Pro' },
  { value: 'gemini-3.7-flash', label: 'Gemini 3.7 flash' },
  { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 flash lite' },
]

// Popular ElevenLabs voice presets for easy selection
const VOICE_PRESETS = [
  { id: 'pNInz6obpgDQGcFmaJgB', label: 'Adam — Deep, chill (default)' },
  { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Sarah — Warm, friendly' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', label: 'Liam — Casual, young' },
  { id: 'XB0fDUnXU5powFXDhCwa', label: 'Charlotte — Friendly, upbeat' },
  { id: 'custom', label: 'Custom Voice ID' },
]

export function SettingsPanel({ settings, onSave, onClose }: SettingsPanelProps) {
  const [form, setForm] = useState({ ...settings })
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [showElevenKey, setShowElevenKey] = useState(false)
  const [voicePreset, setVoicePreset] = useState(() => {
    const known = VOICE_PRESETS.find(p => p.id === settings.elevenLabsVoiceId && p.id !== 'custom')
    return known ? known.id : 'custom'
  })

  // When preset changes, update the voice ID (unless custom)
  useEffect(() => {
    if (voicePreset !== 'custom') {
      setForm(f => ({ ...f, elevenLabsVoiceId: voicePreset }))
    }
  }, [voicePreset])

  const set = (key: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [key]: e.target.value }))
  }

  const handleSave = () => {
    onSave(form)
    onClose()
  }

  const handleReset = () => {
    setForm({ ...DEFAULT_SETTINGS })
    setVoicePreset(DEFAULT_SETTINGS.elevenLabsVoiceId)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-slide-up max-h-[90dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Settings</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Keys are stored locally only</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Scrollable form body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Friend name */}
          <Section label="Your AI Friend's Name">
            <input
              type="text"
              value={form.friendName}
              onChange={set('friendName')}
              placeholder="e.g. Kai, Nova, Buddy..."
              className="input"
            />
          </Section>

          {/* Gemini */}
          <Section label="Google Gemini API Key" hint={<a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300">Get key →</a>}>
            <PasswordInput
              value={form.geminiApiKey}
              onChange={set('geminiApiKey')}
              show={showGeminiKey}
              onToggle={() => setShowGeminiKey(s => !s)}
              placeholder="AIza..."
            />
          </Section>

          <Section label="Gemini Model">
            <select
              value={form.geminiModel}
              onChange={set('geminiModel')}
              className="input"
            >
              {GEMINI_MODELS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </Section>

          {/* ElevenLabs */}
          <Section label="ElevenLabs API Key" hint={<a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300">Get key →</a>}>
            <PasswordInput
              value={form.elevenLabsApiKey}
              onChange={set('elevenLabsApiKey')}
              show={showElevenKey}
              onToggle={() => setShowElevenKey(s => !s)}
              placeholder="sk_..."
            />
          </Section>

          <Section label="Voice">
            <select
              value={voicePreset}
              onChange={e => setVoicePreset(e.target.value)}
              className="input mb-2"
            >
              {VOICE_PRESETS.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            {voicePreset === 'custom' && (
              <input
                type="text"
                value={form.elevenLabsVoiceId}
                onChange={set('elevenLabsVoiceId')}
                placeholder="Paste your ElevenLabs Voice ID"
                className="input"
              />
            )}
            <p className="text-xs text-zinc-500 mt-1.5">
              Find more voices in the{' '}
              <a href="https://elevenlabs.io/app/voice-library" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300">ElevenLabs Voice Library</a>
            </p>
          </Section>

        </div>

        {/* Footer buttons */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-zinc-800">
          <button
            onClick={handleReset}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Reset defaults
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 text-sm bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-colors font-medium"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{label}</label>
        {hint && <span className="text-xs">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

interface PasswordInputProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  show: boolean
  onToggle: () => void
  placeholder: string
}

function PasswordInput({ value, onChange, show, onToggle, placeholder }: PasswordInputProps) {
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="input pr-10"
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
        aria-label={show ? 'Hide key' : 'Show key'}
      >
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  )
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  )
}
