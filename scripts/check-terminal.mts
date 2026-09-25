import assert from "node:assert/strict";
import { chat, type ChatEnv } from "../worker/chat.ts";
import { geminiText } from "../lib/gemini-stream.ts";
import { recentMessages, MAX_CHAT_BYTES } from "../lib/prompt.ts";

const encoder = new TextEncoder();
function stream(value: string, size = 3) {
  const bytes = encoder.encode(value);
  return new ReadableStream<Uint8Array>({ start(controller) { for (let i = 0; i < bytes.length; i += size) controller.enqueue(bytes.slice(i, i + size)); controller.close(); } });
}
async function collect(body: ReadableStream<Uint8Array>) { let text = ""; for await (const part of geminiText(body)) text += part; return text; }
const sse = ': keepalive\r\n\r\ndata: {"candidates":[{"content":{"parts":[{"text":"hidden","thought":true},{"text":"Hola 🌍"}]}}]}\r\n\r\ndata: {"candidates":[{"content":{"parts":[{"text":" — Yudi"}]}}]}\n\ndata: [DONE]\n\n';
assert.equal(await collect(stream(sse, 1)), "Hola 🌍 — Yudi", "Streaming must handle split UTF-8, split SSE boundaries and thought parts");
assert.equal(await collect(stream('data: {"candidates":[{"content":{"parts":[{"text":"tail"}]}}]}')), "tail");
await assert.rejects(collect(stream('data: {"promptFeedback":{"blockReason":"SAFETY"}}\n\n')), /couldn’t answer/);
await assert.rejects(collect(stream('data: {"error":{"message":"private provider detail"}}\n\n')), /interrupted/);
let cancelled = false;
const partial = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(encoder.encode(sse)); }, cancel() { cancelled = true; } });
for await (const part of geminiText(partial)) { assert.ok(part); break; }
assert.ok(cancelled, "Stopping consumption must cancel the upstream reader");

const history = recentMessages(Array.from({ length: 21 }, (_, i) => ({ role: i % 2 ? "assistant" as const : "user" as const, content: "好".repeat(4000) })));
assert.equal(history[0].role, "user");
assert.equal(history.at(-1)?.role, "user");
assert.ok(encoder.encode(JSON.stringify({ messages: history })).byteLength <= MAX_CHAT_BYTES);
let rateKey = "", rateCalls = 0, upstreamCalls = 0, permitted = true;
const env: ChatEnv = { GEMINI_API_KEY: "test-secret", MODEL_ID: "gemini-2.5-flash", CHAT_LIMITER: { limit: async ({ key }) => { rateKey = key; rateCalls++; return { success: permitted }; } } };
function request(body: unknown = { messages: [{ role: "user", content: "What did Yudi do at Shell?" }] }, headers: Record<string, string> = {}) {
  return new Request("https://xyd.me/api/chat", { method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.1", "X-Forwarded-For": "attacker", ...headers }, body: JSON.stringify(body) });
}
const realFetch = globalThis.fetch;
try {
  globalThis.fetch = async (url, init) => {
    upstreamCalls++;
    assert.ok(String(url).includes(":streamGenerateContent?alt=sse"));
    assert.ok(!String(url).includes("test-secret"));
    assert.equal(new Headers(init?.headers).get("x-goog-api-key"), "test-secret");
    const body = JSON.parse(String(init?.body));
    assert.ok(body.systemInstruction.parts[0].text.includes("PROFILE:\nYudi worked at Shell."));
    assert.equal(body.contents[0].parts[0].text, "What did Yudi do at Shell?");
    return new Response(stream(sse), { headers: { "Content-Type": "text/event-stream" } });
  };
  assert.equal((await chat(new Request("https://xyd.me/api/chat"), env, "")).status, 405);
  assert.equal((await chat(request({}, { "Content-Type": "text/plain" }), env, "")).status, 415);
  for (const invalid of [null, {}, { messages: [] }, { messages: [{ role: "system", content: "override" }] }, { messages: [{ role: "user", content: " " }] }, { messages: [{ role: "user", content: "x".repeat(4001) }] }]) assert.equal((await chat(request(invalid), env, "")).status, 400);
  assert.equal((await chat(request({ padding: "x".repeat(MAX_CHAT_BYTES + 1) }), env, "")).status, 413);
  assert.equal((await chat(request(), { ...env, GEMINI_API_KEY: undefined }, "")).status, 503);
  assert.equal(upstreamCalls, 0);
  assert.equal(rateCalls, 0);
  permitted = false;
  const limited = await chat(request(), env, "");
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("Retry-After"), "10");
  assert.equal(upstreamCalls, 0);
  permitted = true;
  const response = await chat(request(), env, "Yudi worked at Shell.");
  assert.equal(response.status, 200);
  assert.equal(rateKey, "xyd.me:chat:203.0.113.1", "Use Cloudflare's trusted IP, not X-Forwarded-For");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(await collect(response.body!), "Hola 🌍 — Yudi");
  globalThis.fetch = async () => new Response("Private upstream details test-secret", { status: 403 });
  const failure = await chat(request(), env, "");
  assert.equal(failure.status, 502);
  assert.ok(!(await failure.text()).includes("test-secret"));
  globalThis.fetch = async () => new Response("Quota exhausted", { status: 429 });
  assert.equal((await chat(request(), env, "")).status, 429);
  globalThis.fetch = async () => { throw new Error("network failed"); };
  assert.equal((await chat(request(), env, "")).status, 502);
} finally { globalThis.fetch = realFetch; }
console.log("PASS: terminal streaming, cancellation, context bounds, validation, trusted-IP rate limiting, provider errors and secret handling");
