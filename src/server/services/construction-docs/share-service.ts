import { createHash, randomBytes, timingSafeEqual } from 'crypto'

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function generateShareToken(): string {
  return randomBytes(32).toString('hex')
}

export function hashShareToken(token: string): string {
  return sha256(token)
}

export function hashSharePassword(password: string): string {
  return sha256(password)
}

export function verifySharePassword(password: string, expectedHash: string | null): boolean {
  if (!expectedHash) return true
  const candidate = hashSharePassword(password)
  const a = Buffer.from(candidate, 'hex')
  const b = Buffer.from(expectedHash, 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

