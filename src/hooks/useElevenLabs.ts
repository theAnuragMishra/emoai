import { useCallback, useRef } from 'react'
import { Settings } from '../types'

export function useElevenLabs() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)

  // ─── Speech-to-Text ──────────────────────────────────────────────────────────
  const transcribeAudio = useCallback(
    async (audioBlob: Blob, settings: Settings): Promise<string> => {
      if (!settings.elevenLabsApiKey.trim()) {
        throw new Error('ElevenLabs API key is not set. Open settings to add it.')
      }

      const formData = new FormData()
      formData.append('file', audioBlob, 'recording.webm')
      formData.append('model_id', 'scribe_v1')

      const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST',
        headers: {
          'xi-api-key': settings.elevenLabsApiKey,
        },
        body: formData,
      })

      if (!response.ok) {
        const err = await response.json().catch(() => null)
        const msg = err?.detail?.message ?? err?.detail ?? `HTTP ${response.status}`
        throw new Error(`ElevenLabs STT error: ${msg}`)
      }

      const data = await response.json()
      const text = data.text as string | undefined
      if (!text?.trim()) {
        throw new Error("Couldn't catch that — try again?")
      }
      return text.trim()
    },
    []
  )

  // ─── Text-to-Speech ───────────────────────────────────────────────────────────
  const speakText = useCallback(
    async (
      text: string,
      settings: Settings,
      onEnd?: () => void
    ): Promise<void> => {
      if (!settings.elevenLabsApiKey.trim()) {
        throw new Error('ElevenLabs API key is not set. Open settings to add it.')
      }

      // Stop any currently playing audio
      stopSpeaking()

      const voiceId = settings.elevenLabsVoiceId || 'pNInz6obpgDQGcFmaJgB'
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': settings.elevenLabsApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => null)
        const msg = err?.detail?.message ?? err?.detail ?? `HTTP ${response.status}`
        throw new Error(`ElevenLabs TTS error: ${msg}`)
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      audioUrlRef.current = objectUrl

      const audio = new Audio(objectUrl)
      audioRef.current = audio

      audio.onended = () => {
        cleanupAudio()
        onEnd?.()
      }

      audio.onerror = () => {
        cleanupAudio()
        onEnd?.()
      }

      await audio.play()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current = null
    }
    cleanupAudio()
  }, [])

  function cleanupAudio() {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
  }

  return { transcribeAudio, speakText, stopSpeaking }
}
