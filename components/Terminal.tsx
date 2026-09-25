"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MessageLine } from "./MessageLine";
import { Thinking } from "./Thinking";
import { geminiText } from "@/lib/gemini-stream";
import { recentMessages, type ChatMessage } from "@/lib/prompt";

const greeting = "🤗 Welcome! My name is KITT, the AI assistant of Yudi. This is the original interactive terminal. Just type your questions and press Enter.\n\nThings you can ask about Yudi:\n- What are his biggest achievements?\n- Tell me about his professional experience.\n- What technologies is he passionate about?\n\nType 'help' for commands, or 'clear' to start fresh.";
const help = "Ask me anything about Yudi’s work, projects, or background.\n\nhelp  — show these commands\nclear — clear the conversation\n\nUse Stop (or Escape) to stop a response. Your conversation stays in this tab.";

export default function Terminal() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef(true);

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    function track() { bottomRef.current = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 140; }
    window.addEventListener("scroll", track, { passive: true });
    return () => window.removeEventListener("scroll", track);
  }, []);
  useEffect(() => { if (bottomRef.current) endRef.current?.scrollIntoView({ behavior: "instant", block: "end" }); }, [messages, busy, error]);
  useEffect(() => { if (!busy) inputRef.current?.focus({ preventScroll: true }); }, [busy]);
  useEffect(() => {
    function stop(event: KeyboardEvent) { if (event.key === "Escape") controller.current?.abort(); }
    window.addEventListener("keydown", stop);
    return () => window.removeEventListener("keydown", stop);
  }, []);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (controller.current || !input.trim()) return;
    const question = input.trim();
    setInput(""); setError("");
    if (question.toLowerCase() === "clear") { setMessages([]); setShowHelp(false); return; }
    if (question.toLowerCase() === "help") { setShowHelp(true); return; }
    const next: ChatMessage[] = [...messages, { role: "user", content: question }];
    const active = new AbortController();
    controller.current = active;
    setMessages(next); setBusy(true); bottomRef.current = true;
    let answer = "";
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: recentMessages(next) }),
        signal: active.signal,
      });
      if (!response.ok) throw new Error((await response.text()).slice(0, 300) || "KITT couldn’t answer. Please try again.");
      if (!response.body || !response.headers.get("Content-Type")?.includes("text/event-stream")) throw new Error("KITT’s connection is unavailable. Please try again.");
      for await (const chunk of geminiText(response.body)) {
        if (active.signal.aborted) break;
        answer += chunk;
        setMessages([...next, { role: "assistant", content: answer }]);
      }
      if (!answer && !active.signal.aborted) throw new Error("KITT had no answer. Try asking the question another way.");
    } catch (caught) {
      if (!active.signal.aborted) setError(caught instanceof Error ? caught.message : "Connection interrupted. Please try again.");
    } finally {
      if (controller.current === active) { controller.current = null; setBusy(false); }
    }
  }

  return <div className="terminal-page">
    <div className="terminal-window">
      <header className="terminal-topbar"><Link href="/">← Back to the notebook</Link><span>THE ORIGINAL XYD.ME</span></header>
      <main>
        <h1 className="visually-hidden">Yudi’s terminal</h1>
        <pre className="terminal-ascii" aria-hidden="true">{`██╗  ██╗ ██╗   ██╗ ██████╗
╚██╗██╔╝ ╚██╗ ██╔╝ ██╔══██╗
 ╚███╔╝   ╚████╔╝  ██║  ██║
 ╔███╚╗    ╚██╔╝   ██║  ██║
██╔╝╚██╗    ██║    ██████╔╝
╚═╝  ╚═╝    ╚═╝    ╚═════╝ .me`}</pre>
        <MessageLine role="assistant" content={greeting}/>
        {showHelp && <MessageLine role="assistant" content={help}/>}
        <section aria-label="Conversation" aria-busy={busy}>{messages.map((message, i) => <MessageLine key={i} {...message}/>)}</section>
        {busy && messages.at(-1)?.role === "user" && <Thinking/>}
        {error && <p className="terminal-error" role="alert">{error}</p>}
      </main>
      <form className="terminal-input" onSubmit={send}>
        <label htmlFor="terminal-question"><span className="terminal-visitor">visitor@xyd.me:</span><span className="terminal-path">$ ~</span><span className="visually-hidden">Your question</span></label>
        <input id="terminal-question" ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} placeholder={busy ? "KITT is answering…" : "Ask about Yudi…"} maxLength={4000} disabled={busy} autoComplete="off"/>
        {busy ? <button type="button" onClick={() => controller.current?.abort()}>Stop</button> : <button disabled={!input.trim()}>Send ↵</button>}
      </form>
      <div ref={endRef}/>
      <footer className="terminal-footer">Powered by Gemini · Based on Yudi’s profile · Answers may be imperfect.</footer>
    </div>
  </div>;
}
