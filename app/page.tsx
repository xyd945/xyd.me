'use client';
import { useEffect, useRef, useState } from 'react';
import { MessageLine } from '@/components/MessageLine';
import { Thinking } from '@/components/Thinking';

const AsciiArt = () => (
  <pre className="text-theme-accent text-xs leading-none">
{`██╗   ██╗██╗   ██╗██████╗ ██╗
╚██╗ ██╔╝██║   ██║██╔══██╗██║
 ╚████╔╝ ██║   ██║██║  ██║██║
  ╚██╔╝  ██║   ██║██║  ██║██║
   ██║   ╚██████╔╝██████╔╝██║
   ╚═╝    ╚═════╝ ╚═════╝ ╚═╝`}
  </pre>
);

export default function Page() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Set initial greeting message on component mount
  useEffect(() => {
    setMessages([
      {
        role: 'assistant',
        content: `🤗 Welcome! My name is KITT, the AI assistant of Yudi. This is an interactive terminal🖥️. Just type your questions and press Enter.\n\nHere are some things you can ask about Yudi:\n- What are his biggest achievements?\n- Tell me about his professional experience.\n- What technologies is he passionate about?\n\nType 'help' for more commands.`
      }
    ]);
    inputRef.current?.focus();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handlePageClick = () => {
    inputRef.current?.focus();
  };

  async function send() {
    if (loading || !input.trim()) return;

    const next = [...messages, { role: 'user' as const, content: input }];
    setMessages(next);
    setInput('');
    setLoading(true);
    controllerRef.current = new AbortController();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: next }),
        signal: controllerRef.current.signal,
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok || !res.body) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong.' }]);
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let isFirstChunk = true;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        if (isFirstChunk) {
          setLoading(false);
          setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
          isFirstChunk = false;
        }
        
        await new Promise(resolve => setTimeout(resolve, 20));

        assistantMessage += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].content = assistantMessage;
          return newMessages;
        });
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, an error occurred.' }]);
      }
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="bg-theme-bg font-mono text-xs p-4 h-screen" onClick={handlePageClick}>
      <div className="max-w-4xl mx-auto">
        <AsciiArt />
        <main className="mt-4">
          {messages.map((m, i) => (
            <MessageLine key={i} role={m.role} content={m.content} />
          ))}
          {loading && <Thinking />}
          <div ref={messagesEndRef} />
        </main>
        <footer className="mt-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2"
          >
            <span className="text-theme-primary">visitor@xyd.me:</span>
            <span className="text-theme-secondary">$ ~</span>
            <input
              ref={inputRef}
              className="chat-input flex-1 bg-transparent focus:outline-none border-none"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </form>
        </footer>
      </div>
    </div>
  );
}
