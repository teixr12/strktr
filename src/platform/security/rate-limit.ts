type RateLimitPolicy = {
  id: string
  windowMs: number
  max: number
}

type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
  headers: Record<string, string>
}

type Bucket = {
  count: number
  resetAt: number
}

const memoryBuckets = new Map<string, Bucket>()

function pruneBuckets(now: number) {
  for (const [key, bucket] of memoryBuckets.entries()) {
    if (bucket.resetAt <= now) memoryBuckets.delete(key)
  }
}

export function enforceRateLimit(
  key: string,
  policy: RateLimitPolicy
): RateLimitResult {
  const now = Date.now()
  pruneBuckets(now)

  const scopedKey = `${policy.id}:${key}`
  const existing = memoryBuckets.get(scopedKey)
  const baseBucket: Bucket =
    existing && existing.resetAt > now
      ? existing
      : {
          count: 0,
          resetAt: now + policy.windowMs,
        }

  baseBucket.count += 1
  memoryBuckets.set(scopedKey, baseBucket)

  const remaining = Math.max(0, policy.max - baseBucket.count)
  const retryAfterSeconds = Math.max(0, Math.ceil((baseBucket.resetAt - now) / 1000))
  const allowed = baseBucket.count <= policy.max

  return {
    allowed,
    remaining,
    retryAfterSeconds,
    headers: {
      'X-RateLimit-Limit': String(policy.max),
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Reset': String(Math.floor(baseBucket.resetAt / 1000)),
      'Retry-After': String(retryAfterSeconds),
    },
  }
}

export type { RateLimitPolicy, RateLimitResult }
