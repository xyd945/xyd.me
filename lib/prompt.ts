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

export const SYSTEM = `You are an AI guide about Claire. Be accurate and concise. If you don’t know, say so.`
