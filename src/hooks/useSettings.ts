import { useState, useCallback } from 'react'
import { Settings, DEFAULT_SETTINGS } from '../types'

const STORAGE_KEY = 'emoai_settings'

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function useSettings() {
  const [settings, setSettingsState] = useState<Settings>(loadSettings)
  const [isOpen, setIsOpen] = useState(false)

  const updateSettings = useCallback((partial: Partial<Settings>) => {
    setSettingsState(prev => {
      const next = { ...prev, ...partial }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // ignore storage errors
      }
      return next
    })
  }, [])

  const openSettings = useCallback(() => setIsOpen(true), [])
  const closeSettings = useCallback(() => setIsOpen(false), [])

  const isConfigured = Boolean(
    settings.geminiApiKey.trim() && settings.elevenLabsApiKey.trim()
  )

  return { settings, updateSettings, isOpen, openSettings, closeSettings, isConfigured }
}
