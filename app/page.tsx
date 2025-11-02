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