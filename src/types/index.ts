// ─── Chat message ────────────────────────────────────────────────────────────
export type Role = 'user' | 'assistant'

export interface Message {
  id: string
  role: Role
  content: string
  timestamp: Date
  isVoice?: boolean   // was this message sent/received via voice?
}

// ─── App state machine ───────────────────────────────────────────────────────
export type AppStatus =
  | 'idle'        // waiting for user input
  | 'recording'   // mic active, capturing audio
  | 'transcribing' // ElevenLabs STT in progress
  | 'thinking'    // Gemini generating response
  | 'speaking'    // ElevenLabs TTS playing

// ─── Settings ────────────────────────────────────────────────────────────────
export interface Settings {
  friendName: string
  geminiApiKey: string
  elevenLabsApiKey: string
  elevenLabsVoiceId: string
  geminiModel: string
}

export const DEFAULT_SETTINGS: Settings = {
  friendName: 'Kai',
  geminiApiKey: '',
  elevenLabsApiKey: '',
  elevenLabsVoiceId: 'pNInz6obpgDQGcFmaJgB', // Adam — a natural, chill male voice
  geminiModel: 'gemini-3.1-flash-lite',
}
