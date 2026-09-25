import { buildPrompt, MAX_CHAT_BYTES, type ChatMessage } from "../lib/prompt.ts";

export interface ChatEnv {
  GEMINI_API_KEY?: string;
  MODEL_ID?: string;
  CHAT_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> };
}
function reply(message: string, status: number, headers?: Record<string, string>) {
  return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers } });
}

export async function chat(request: Request, env: ChatEnv, profile: string): Promise<Response> {
  if (request.method !== "POST") return reply("Use POST to talk to KITT.", 405, { Allow: "POST" });
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) return reply("Send a JSON chat request.", 415);
  if (Number(request.headers.get("Content-Length")) > MAX_CHAT_BYTES) return reply("This conversation is too long. Clear the terminal and try again.", 413);
  let messages: ChatMessage[];
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply("Add a question first.", 400);
    const decoder = new TextDecoder();
    let text = "", size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_CHAT_BYTES) { await reader.cancel(); return reply("This conversation is too long. Clear the terminal and try again.", 413); }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally { reader.releaseLock(); }
    const input = JSON.parse(text);
    if (!Array.isArray(input?.messages) || input.messages.length < 1 || input.messages.length > 10 || input.messages.some((message: unknown) => {
      if (!message || typeof message !== "object") return true;
      const { role, content } = message as ChatMessage;
      return !["user", "assistant"].includes(role) || typeof content !== "string" || !content.trim() || content.length > 4000;
    }) || input.messages[0].role !== "user" || input.messages.at(-1).role !== "user") return reply("Send a question with up to 10 recent messages, each under 4,000 characters.", 400);
    messages = input.messages;
  } catch { return reply("Could not read that question. Please try again.", 400); }

  if (!env.GEMINI_API_KEY) return reply("KITT is offline while the owner connects its Gemini key. Please try again later.", 503);
  try {
    const { success } = await env.CHAT_LIMITER.limit({ key: `xyd.me:chat:${request.headers.get("CF-Connecting-IP") ?? "local"}` });
    if (!success) return reply("A few too many questions at once. Try again in 10 seconds.", 429, { "Retry-After": "10" });
    const model = env.MODEL_ID || "gemini-2.5-flash";
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify(buildPrompt(messages, profile)),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]),
    });
    if (!upstream.ok || !upstream.body) {
      await upstream.body?.cancel();
      return reply(upstream.status === 429 ? "KITT has reached its Gemini usage limit. Please try again later." : "KITT couldn’t reach Gemini. Please try again in a moment.", upstream.status === 429 ? 429 : 502);
    }
    return new Response(upstream.body, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return reply("KITT couldn’t connect. Please try again in a moment.", 502); }
}
