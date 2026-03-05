import { expect, test } from '@playwright/test'

const E2E_BEARER_TOKEN = process.env.E2E_BEARER_TOKEN || ''
const E2E_OBRA_ID = process.env.E2E_OBRA_ID || ''
const isCI = process.env.CI === 'true' || process.env.CI === '1'
const hasRequiredEnv = Boolean(E2E_BEARER_TOKEN && E2E_OBRA_ID)

type PerfTarget = {
  id: string
  route: string
  p95BudgetMs: number
  payloadBudgetBytes: number
}

function asInt(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function percentile(values: number[], ratio: number) {
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.max(0, Math.ceil(sorted.length * ratio) - 1)
  return sorted[idx]
}

const warmupRuns = asInt(process.env.PERF_SLO_WARMUP_RUNS, 2, 0, 10)
const measureRuns = asInt(process.env.PERF_SLO_MEASURE_RUNS, 10, 3, 30)

const targets: PerfTarget[] = [
  {
    id: 'leads',
    route: '/api/v1/leads?page=1&pageSize=20',
    p95BudgetMs: asInt(process.env.PERF_BUDGET_LEADS_P95_MS, 1800, 200, 8000),
    payloadBudgetBytes: asInt(process.env.PERF_BUDGET_LEADS_PAYLOAD_BYTES, 450000, 30000, 2_000_000),
  },
  {
    id: 'financeiro',
    route: '/api/v1/transacoes?page=1&pageSize=20',
    p95BudgetMs: asInt(process.env.PERF_BUDGET_FINANCEIRO_P95_MS, 2000, 200, 8000),
    payloadBudgetBytes: asInt(process.env.PERF_BUDGET_FINANCEIRO_PAYLOAD_BYTES, 500000, 30000, 2_000_000),
  },
  {
    id: 'obra-detail',
    route: `/api/v1/obras/${E2E_OBRA_ID}`,
    p95BudgetMs: asInt(process.env.PERF_BUDGET_OBRA_DETAIL_P95_MS, 1600, 200, 8000),
    payloadBudgetBytes: asInt(process.env.PERF_BUDGET_OBRA_DETAIL_PAYLOAD_BYTES, 250000, 10000, 2_000_000),
  },
]

test.describe('performance core api budgets', () => {
  test.beforeAll(() => {
    if (isCI && !hasRequiredEnv) {
      throw new Error('CI must provide E2E_BEARER_TOKEN and E2E_OBRA_ID for performance budget checks')
    }
  })

  test.skip(!hasRequiredEnv && !isCI, 'Set E2E_BEARER_TOKEN and E2E_OBRA_ID to run performance tests locally')

  test('core read endpoints stay within p95 and payload budgets', async ({ request }) => {
    test.setTimeout(180_000)

    const headers = {
      Authorization: `Bearer ${E2E_BEARER_TOKEN}`,
    }

    for (const target of targets) {
      await test.step(`budget check: ${target.id}`, async () => {
        const latencies: number[] = []
        const payloadSizes: number[] = []
        const totalRuns = warmupRuns + measureRuns

        for (let i = 0; i < totalRuns; i += 1) {
          const path = `${target.route}${target.route.includes('?') ? '&' : '?'}_perf=${Date.now()}_${i}`
          const startedAt = Date.now()
          const response = await request.get(path, { headers })
          const latencyMs = Date.now() - startedAt

          expect(response.status(), `${target.id} status`).toBe(200)

          const raw = await response.text()
          const payload = JSON.parse(raw) as { data?: unknown }
          expect(payload).toHaveProperty('data')

          if (i >= warmupRuns) {
            latencies.push(latencyMs)
            payloadSizes.push(Buffer.byteLength(raw, 'utf8'))
          }
        }

        const p95Ms = percentile(latencies, 0.95)
        const maxPayloadBytes = Math.max(...payloadSizes)

        console.log(
          `[perf-core] target=${target.id} p95Ms=${p95Ms} budgetMs=${target.p95BudgetMs} maxPayloadBytes=${maxPayloadBytes} payloadBudgetBytes=${target.payloadBudgetBytes} runs=${measureRuns}`
        )

        expect(p95Ms, `${target.id} p95`).toBeLessThanOrEqual(target.p95BudgetMs)
        expect(maxPayloadBytes, `${target.id} payload`).toBeLessThanOrEqual(target.payloadBudgetBytes)
      })
    }
  })
})
