import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { buildPrompt } from '@/lib/prompt'
import { rateLimit } from '@/lib/rate-limit'



export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const limited = await rateLimit(ip)
  if (limited) {
    return new Response('Rate limit exceeded', { status: 429 })
  }

  const { messages } = await req.json() as {
    messages: { role: 'user'|'assistant'; content: string }[]
  }

  const { system, profile, userText } = await buildPrompt(messages)

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({ model: process.env.MODEL_ID || 'gemini-2.5-flash' })

  // Gemini streaming
  const streamResult = await model.generateContentStream({
    contents: [
      { role: 'user', parts: [{ text: `${system}\n\nPROFILE:\n${profile}\n\nUSER:\n${userText}` }] }
    ]
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamResult.stream) {
          // chunk.text() returns incremental text
          controller.enqueue(encoder.encode(chunk.text()))
        }
        controller.close()
      } catch (err) {
        controller.error(err)
      }
    }
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  })
}
