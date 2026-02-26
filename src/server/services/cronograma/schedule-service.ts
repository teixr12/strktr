type CronogramaItemInput = {
  id: string
  status: string
  duracao_dias: number | null
  data_inicio_planejada: string | null
  data_fim_planejada: string | null
}

type DependenciaInput = {
  predecessor_item_id: string
  successor_item_id: string
  lag_dias: number | null
}

type CalendarioInput = {
  dias_uteis?: number[]
  feriados?: string[]
} | null | undefined

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function toIsoDate(date: Date | null): string | null {
  if (!date) return null
  return date.toISOString().slice(0, 10)
}

function diffDays(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function addCalendarDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function normalizeCalendar(calendario?: CalendarioInput) {
  const fallbackWorkingDays = [1, 2, 3, 4, 5]
  const workingDays = (calendario?.dias_uteis || fallbackWorkingDays)
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
  const feriados = new Set((calendario?.feriados || []).filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)))

  return {
    workingDays: workingDays.length > 0 ? workingDays : fallbackWorkingDays,
    feriados,
  }
}

function isWorkingDay(date: Date, calendar: { workingDays: number[]; feriados: Set<string> }) {
  const iso = date.toISOString().slice(0, 10)
  if (calendar.feriados.has(iso)) return false
  return calendar.workingDays.includes(date.getUTCDay())
}

function alignToWorkingDay(date: Date, calendar: { workingDays: number[]; feriados: Set<string> }) {
  let cursor = new Date(date)
  let guard = 0
  while (!isWorkingDay(cursor, calendar) && guard < 14) {
    cursor = addCalendarDays(cursor, 1)
    guard += 1
  }
  return cursor
}

function addBusinessDays(date: Date, amount: number, calendar: { workingDays: number[]; feriados: Set<string> }) {
  let cursor = alignToWorkingDay(date, calendar)
  if (amount <= 0) return cursor

  let added = 0
  while (added < amount) {
    cursor = addCalendarDays(cursor, 1)
    if (isWorkingDay(cursor, calendar)) {
      added += 1
    }
  }
  return cursor
}

export function recalculateSchedule(
  items: CronogramaItemInput[],
  dependencias: DependenciaInput[],
  calendario?: CalendarioInput
) {
  const calendar = normalizeCalendar(calendario)
  const itemMap = new Map<string, CronogramaItemInput>(items.map((item) => [item.id, item]))
  const incoming = new Map<string, DependenciaInput[]>()
  for (const dep of dependencias) {
    const list = incoming.get(dep.successor_item_id) || []
    list.push(dep)
    incoming.set(dep.successor_item_id, list)
  }

  const updates: Array<{
    id: string
    data_inicio_planejada: string | null
    data_fim_planejada: string | null
    atraso_dias: number
  }> = []

  for (const item of items) {
    const currentStart = toDate(item.data_inicio_planejada)
    const duration = Math.max(item.duracao_dias || 1, 1)
    const deps = incoming.get(item.id) || []

    let computedStart = currentStart
    for (const dep of deps) {
      const predecessor = itemMap.get(dep.predecessor_item_id)
      if (!predecessor) continue
      const predEnd = toDate(predecessor.data_fim_planejada)
      if (!predEnd) continue
      const candidate = addBusinessDays(predEnd, dep.lag_dias || 0, calendar)
      if (!computedStart || candidate > computedStart) {
        computedStart = candidate
      }
    }

    if (computedStart) {
      computedStart = alignToWorkingDay(computedStart, calendar)
    }

    const computedEnd = computedStart
      ? addBusinessDays(computedStart, Math.max(duration - 1, 0), calendar)
      : toDate(item.data_fim_planejada)
    const now = new Date()
    const atraso = computedEnd && item.status !== 'concluido' && now > computedEnd
      ? diffDays(now, computedEnd)
      : 0

    updates.push({
      id: item.id,
      data_inicio_planejada: toIsoDate(computedStart),
      data_fim_planejada: toIsoDate(computedEnd),
      atraso_dias: Math.max(atraso, 0),
    })
  }

  const delayed = updates.filter((item) => item.atraso_dias > 0).map((item) => item.id)
  const blocked = items.filter((item) => item.status === 'bloqueado').map((item) => item.id)
  const projectedEnd = updates
    .map((item) => toDate(item.data_fim_planejada))
    .filter((item): item is Date => Boolean(item))
    .sort((a, b) => b.getTime() - a.getTime())[0] || null

  return {
    updates,
    summary: {
      totalItems: items.length,
      delayedItems: delayed.length,
      blockedItems: blocked.length,
      criticalItemIds: Array.from(new Set([...blocked, ...delayed])),
      projectedEndDate: toIsoDate(projectedEnd),
    },
  }
}
