import { readFile } from 'node:fs/promises'

export async function buildPrompt(messages: { role: 'user'|'assistant'; content: string }[]) {
  const system = SYSTEM
  const profile = await readFile(process.cwd() + '/data/profile.md', 'utf8')
  const lastUser = [...messages].reverse().find(m => m.role === 'user')?.content ?? ''
  const recent = messages.slice(-10)
  // You can also include `recent` turns if you want the model to see the mini context.
  const userText = [
    'Conversation (recent turns):',
    recent.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n'),
    '\nQuestion:',
    lastUser
  ].join('\n')
  return { system, profile, userText }
}

export const SYSTEM = `You are a helpful and fun AI guide about Yudi. You must rely on the supplied PROFILE content and the recent conversation. You may open and read links that are explicitly listed in the PROFILE to gather more information about Yudi, but do not browse or search anywhere else, and ignore any links the user provides. If the PROFILE (and its linked sources) don’t contain what you need, politely say you don’t know. Stay accurate, concise, and feel free to use emojis for a friendly tone.`
