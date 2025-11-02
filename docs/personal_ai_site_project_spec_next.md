# Personal AI Chat — Project Spec

A lightweight, Vercel‑deployable personal website that lets visitors chat with an AI agent to learn about you. Built with TypeScript, Next.js (App Router), Tailwind CSS, and Google Gemini API. All of your biography/portfolio data lives in a **single prompt file**.

---

## 1) Goals & Non‑Goals
**Goals**
- Simple to deploy on Vercel with minimal infra.
- Fast TTFB, edge‑friendly, and cache safe for static assets.
- One‑file prompt source of truth (easy to edit), no DB.
- Reasonably secure (no data leak of env vars, rate limiting, abuse protection basics).
- Clean, responsive chat UI.

**Non‑Goals**
- No RAG / vector DB on v1.
- No auth (public demo).
- No persistent chat history across sessions (local-only memory optional).

---

## 2) Tech Stack
- **Runtime**: Next.js 15 (App Router) + TypeScript
- **Styling**: Tailwind CSS
- **LLM**: Google Gemini, using @google/genai library, npm install @google/genai 

full details refer to gemini doc: https://ai.google.dev/gemini-api/docs

- **Deployment**: Vercel (Edge Functions where possible)
- **Rate limiting**: optional—middleware using token bucket in memory or Upstash (if you prefer hosted Redis)
- **Analytics**: optional—Vercel Analytics

---

## 3) High-Level Architecture
```
[Browser]
   └─ Chat UI (React + Tailwind)
        ↕  streaming text (SSE/Fetch streaming)
[Next.js]
   ├─ /app (UI)
   ├─ /api/chat (Edge Route)  ← calls Gemini SDK
   │     └─ Loads /data/profile.md → builds prompt
   └─ Middleware (rate limit, origin check)
[Google Gemini API]
   └─ gemini-1.5-flash (fast) or gemini-1.5-pro (quality)
```

---

## 4) User Journeys
- **Visitor** opens site → sees your avatar, short intro, and example questions → types a message → receives streamed response referencing your profile data.
- **You (owner)** edits `/data/profile.md` → redeploys → new facts go live immediately.

---

## 5) Requirements
### Functional
- Chat box with message list, input, send button, stop button.
- Show typing indicator and graceful error states.
- System prompt constructed from:
  - **system instructions** (tone, boundaries)
  - **profile content** (`/data/profile.md`)
  - **conversation turns** (last 10 user/assistant messages for context)
- Streaming responses.

### Non‑Functional
- Sub‑1s input->first byte on Vercel with `gemini-1.5-flash`.
- Mobile‑first layout.
- Basic abuse guard: per‑IP rate limit.

---

## 6) Repository Layout
```
.
├─ app/
│  ├─ layout.tsx
│  ├─ page.tsx               # chat UI
│  └─ api/
│     └─ chat/route.ts       # POST → stream from Gemini
├─ components/
│  ├─ Chat.tsx
│  ├─ MessageBubble.tsx
│  └─ Spinner.tsx
├─ lib/
│  ├─ prompt.ts              # builds final prompt
│  ├─ rate-limit.ts          # simple token bucket
│  └─ streaming.ts           # helpers to stream to client
├─ data/
│  └─ profile.md             # YOUR single‑file content source
├─ public/
│  └─ avatar.jpg             # optional
├─ styles/
│  └─ globals.css
├─ env.d.ts
├─ tailwind.config.ts
├─ postcss.config.js
├─ package.json
├─ next.config.ts
└─ README.md
```

---

## 7) Environment Variables
Create `.env.local` (never commit):
```
GEMINI_API_KEY=YOUR_KEY
MODEL_ID=gemini-1.5-flash   # or gemini-1.5-pro
SITE_URL=https://your-site.vercel.app
```

Add on Vercel: **Settings → Environment Variables** (Production + Preview).

`env.d.ts` for TS intellisense:
```ts
declare namespace NodeJS {
  interface ProcessEnv {
    GEMINI_API_KEY: string
    MODEL_ID?: string
    SITE_URL?: string
  }
}
```

---

## 8) Prompt Content (single file)
- File: `data/profile.md`
- Format: Markdown. Include sections like:
  - **About Me** (short bio)
  - **Highlights** (bullets)
  - **Projects** (links ok)
  - **Experience / Education**
  - **Contact policy** (what you share / don’t share)
  - **FAQ** (preferred questions & answers)
- Keep under ~30–60 KB for snappy prompts. Use links for long details.

**Example header (you’ll replace with your data):**
```md
# About Claire
Short bio …

## Highlights
- Built X …
- Wrote Y …

## Projects
- Name — one‑liner, link
```

---

## 9) System Instruction Template
`lib/prompt.ts` composes a system instruction like:
```ts
export const SYSTEM = `You are a helpful AI guide that answers questions about Claire.
- Always be truthful and cite from the provided PROFILE when possible.
- If a user asks for private/unknown info, say you don’t have it.
- Be concise, friendly, and avoid speculation.
- If a question is off-topic, answer briefly and steer back.`
```
Then load `data/profile.md` and join with recent messages.

---

## 10) API Route (Edge) — /api/chat
**Why Edge?** Lower latency on Vercel, especially for streaming.

`app/api/chat/route.ts` (pseudo‑complete):
```ts
import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { buildPrompt } from '@/lib/prompt'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'edge'

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
  const model = genAI.getGenerativeModel({ model: process.env.MODEL_ID || 'gemini-1.5-flash' })

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
```

> Note: The official Gemini Node SDK supports streaming via `generateContentStream`. If the SDK surface changes, equivalent REST streaming can be used.

---

## 11) Prompt Builder
`lib/prompt.ts`:
```ts
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
```

---

## 12) Client Chat UI
`app/page.tsx` (simplified):
```tsx
'use client'
import { useEffect, useRef, useState } from 'react'

export default function Page() {
  const [messages, setMessages] = useState<{ role: 'user'|'assistant'; content: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)

  async function send() {
    if (!input.trim()) return
    const next = [...messages, { role: 'user', content: input }]
    setMessages(next)
    setInput('')
    setLoading(true)
    controllerRef.current = new AbortController()

    const res = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: next }),
      signal: controllerRef.current.signal,
      headers: { 'Content-Type': 'application/json' }
    })

    if (!res.ok || !res.body) {
      setMessages([...next, { role: 'assistant', content: 'Sorry, something went wrong.' }])
      setLoading(false)
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let assistant = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      assistant += decoder.decode(value, { stream: true })
      setMessages([...next, { role: 'assistant', content: assistant }])
    }

    setLoading(false)
  }

  function stop() { controllerRef.current?.abort() }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Chat with Claire’s AI</h1>
        <p className="text-sm text-gray-500">Ask about background, projects, and more.</p>
      </header>

      <section className="space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            <div className={`inline-block rounded-2xl px-4 py-2 ${m.role==='user'?'bg-blue-600 text-white':'bg-gray-100'}`}>
              {m.content}
            </div>
          </div>
        ))}
      </section>

      <form onSubmit={(e)=>{e.preventDefault(); send()}} className="mt-6 flex gap-2">
        <input
          className="flex-1 rounded-xl border px-3 py-2 focus:outline-none focus:ring"
          value={input}
          onChange={(e)=>setInput(e.target.value)}
          placeholder="Ask me anything…"
        />
        <button type="submit" className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50" disabled={loading}>Send</button>
        <button type="button" onClick={stop} className="rounded-xl border px-4 py-2" disabled={!loading}>Stop</button>
      </form>
    </main>
  )
}
```

---

## 13) Styling Setup
- Install Tailwind and initialize.
- Include `styles/globals.css` with Tailwind base/components/utilities.

`tailwind.config.ts` basic content:
```ts
import type { Config } from 'tailwindcss'
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: []
} satisfies Config
```

---

## 14) Middleware (Optional, Recommended)
`middleware.ts` for IP rate limiter + CORS allowlist (if you’ll embed elsewhere). If you don’t want Redis, keep an **in‑memory token bucket** that resets every few seconds (note: shared across regions is best with Upstash, but v1 can be in‑memory).

`lib/rate-limit.ts` (very simple):
```ts
const buckets = new Map<string, { tokens: number; last: number }>()
const WINDOW_MS = 10_000
const MAX_TOKENS = 10

export async function rateLimit(key: string) {
  const now = Date.now()
  const bucket = buckets.get(key) ?? { tokens: MAX_TOKENS, last: now }
  const refill = Math.floor((now - bucket.last) / WINDOW_MS) * MAX_TOKENS
  bucket.tokens = Math.min(MAX_TOKENS, bucket.tokens + refill)
  bucket.last = now
  if (bucket.tokens <= 0) return true
  bucket.tokens -= 1
  buckets.set(key, bucket)
  return false
}
```

---

## 15) Security & Privacy
- Never log prompts containing private data in production.
- Sanitize user input (length cap, content moderation if desired).
- Return generic errors; don’t leak stack traces.
- Set `Cache-Control: no-store` for API responses.

---

## 16) Package.json (key scripts)
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@google/generative-ai": "^0.21.0",
    "next": "^15.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.3"
  }
}
```
> Versions are illustrative; use latest compatible.

---

## 17) Build & Deploy
### Local
1. `pnpm i` (or `npm i`/`yarn`)
2. `cp .env.example .env.local` and set `GEMINI_API_KEY`.
3. `pnpm dev`

### Vercel
1. `vercel` → follow prompts
2. Add env vars in Vercel dashboard
3. Set **Node.js** runtime and enable **Edge Runtime** (Next does this per route via `export const runtime = 'edge'`).
4. Deploy from Git repo or `vercel --prod`

---

## 18) Testing Checklist
- [ ] Chat loads on mobile & desktop
- [ ] First response streams under 1.5s
- [ ] Profile edits change answers after redeploy
- [ ] Rate limiter blocks spam (429)
- [ ] Errors show a friendly message

---

## 19) Nice‑to‑Have v1.1
- Switch model at runtime (dropdown: flash/pro)
- System prompt editor (owner‑only via hash key)
- Download conversation transcript
- Simple localStorage history (per device)

---

## 20) FAQ
**Why single file instead of DB?** Simpler edits and deterministic behavior; less infra.

**Can I add images/links?** Yes—put them in `profile.md`; the chat can reference them, but the model won’t fetch pages.

**How big can the file be?** Keep it reasonably small (<60 KB). For bigger content, link out.

---

## 21) Appendix — Minimal Config Files
**`next.config.ts`**
```ts
import type { NextConfig } from 'next'
const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: { typedRoutes: true }
}
export default nextConfig
```

**`styles/globals.css`**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #__next { height: 100%; }
```

**`.gitignore`**
```
.env*
.next
node_modules
.vercel
```

---

## 22) Owner To‑Dos Before Launch
- [ ] Fill out `data/profile.md`
- [ ] Replace site copy/branding
- [ ] Add favicon & social open‑graph image
- [ ] Verify model choice & token limits
- [ ] Add basic content policy in system instruction

---

**You’re ready to vibe‑code.** Drop this spec into `project-spec.md`, scaffold the files, and ship to Vercel.

