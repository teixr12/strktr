type LogLevel = 'info' | 'warn' | 'error'

interface LogContext {
  requestId: string
  orgId?: string | null
  userId?: string
  route?: string
  [key: string]: unknown
}

export function log(level: LogLevel, message: string, context: LogContext) {
  const payload = {
    level,
    message,
    ts: new Date().toISOString(),
    ...context,
  }
  if (level === 'error') {
    console.error(JSON.stringify(payload))
    return
  }
  if (level === 'warn') {
    console.warn(JSON.stringify(payload))
    return
  }
  console.log(JSON.stringify(payload))
}
