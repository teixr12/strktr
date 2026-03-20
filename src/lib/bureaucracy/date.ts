const BRAZIL_TIME_ZONE = 'America/Sao_Paulo'

const BRAZIL_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: BRAZIL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function getPart(parts: Intl.DateTimeFormatPart[], type: 'year' | 'month' | 'day'): string {
  return parts.find((part) => part.type === type)?.value || ''
}

export function getBureaucracyTodayKey(now = new Date()): string {
  const parts = BRAZIL_DATE_FORMATTER.formatToParts(now)
  const year = getPart(parts, 'year')
  const month = getPart(parts, 'month')
  const day = getPart(parts, 'day')

  return `${year}-${month}-${day}`
}

export function isBureaucracyDateOverdue(
  value: string | null | undefined,
  today = getBureaucracyTodayKey()
): boolean {
  return Boolean(value) && value! < today
}
