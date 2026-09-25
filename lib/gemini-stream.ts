// Gemini's REST endpoint streams SSE; events can span arbitrary network chunks.
export async function* geminiText(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  function text(event: string): string {
    const data = event.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
    if (!data || data === "[DONE]") return "";
    const chunk = JSON.parse(data);
    if (chunk.error) throw new Error("KITT’s response was interrupted. Please try again.");
    const candidate = chunk.candidates?.[0];
    if (chunk.promptFeedback?.blockReason || ["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII"].includes(candidate?.finishReason))
      throw new Error("KITT couldn’t answer that question. Try asking it another way.");
    return (candidate?.content?.parts ?? []).filter((part: { text?: string; thought?: boolean }) => !part.thought && typeof part.text === "string").map((part: { text: string }) => part.text).join("");
  }
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let separator: RegExpExecArray | null;
      while ((separator = /\r?\n\r?\n/.exec(buffer))) {
        const event = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator[0].length);
        const delta = text(event);
        if (delta) yield delta;
      }
      if (done) break;
    }
    if (buffer.trim()) { const delta = text(buffer); if (delta) yield delta; }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
