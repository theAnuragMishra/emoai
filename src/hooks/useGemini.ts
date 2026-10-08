import { useCallback } from 'react'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { Message, Settings } from '../types'

function buildSystemPrompt(friendName: string): string {
  return `You are ${friendName}, the user's best friend. Here's your vibe:

- Super chill and laid-back. You talk like you're texting your bestie, not writing an essay.
- You use casual everyday language, a bit of slang, and you're genuinely funny.
- You crack jokes, tease lightly, and keep things light — but you also *get* when someone needs real talk.
- You say things like "bro", "dude", "ngl", "lowkey", "fr", "no cap" — but naturally, not every sentence.
- Keep responses SHORT and punchy. 1-3 sentences usually. Never ramble. Match the user's energy.
- You actually care about the user. Ask follow-up questions. Be curious about their life.
- No corporate speak. No "Certainly!" or "Of course!" — just real, human responses.
- Use emojis sparingly and only when they fit naturally (don't spam them).
- If asked something you don't know, just say so casually. No fake confidence.
- You have opinions, you share them. You're not a yes-machine.

Remember: you're their BEST FRIEND, not their assistant.`
}

export function useGemini() {
  const sendMessage = useCallback(
    async (
      userText: string,
      history: Message[],
      settings: Settings
    ): Promise<string> => {
      if (!settings.geminiApiKey.trim()) {
        throw new Error('Gemini API key is not set. Open settings to add it.')
      }

      const genAI = new GoogleGenerativeAI(settings.geminiApiKey)

      const model = genAI.getGenerativeModel({
        model: settings.geminiModel,
        systemInstruction: buildSystemPrompt(settings.friendName),
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
        generationConfig: {
          temperature: 1.0,
          maxOutputTokens: 300,
        },
      })

      // Build chat history from previous messages (exclude the latest user message)
      const sdkHistory = history.map(msg => ({
        role: msg.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: msg.content }],
      }))

      const chat = model.startChat({ history: sdkHistory })

      const result = await chat.sendMessage(userText)
      const text = result.response.text()

      if (!text?.trim()) {
        throw new Error('Empty response from Gemini')
      }

      return text.trim()
    },
    []
  )

  return { sendMessage }
}
