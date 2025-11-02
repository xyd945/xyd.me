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
