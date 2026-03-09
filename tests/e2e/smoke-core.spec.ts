import { expect, test } from '@playwright/test'

test('health endpoint responde', async ({ request }) => {
  const response = await request.get('/api/v1/health/ops')
  expect(response.ok()).toBeTruthy()

  const payload = await response.json()
  expect(payload.data.status).toBeTruthy()
  expect(payload.data.ts).toBeTruthy()
  expect(payload.data.rollout.wave2Canary).toBeTruthy()
  expect(payload.data.rollout.addressHqCanary).toBeTruthy()
  expect(payload.data.rollout.financeReceiptsCanary).toBeTruthy()
  expect(payload.data.rollout.financeReceiptAiCanary).toBeTruthy()
})

test('login renderiza sem erro fatal', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('button', { name: /(acessar|entrar)/i })).toBeVisible()
})

test('api protegida retorna envelope de erro sem token', async ({ request }) => {
  const response = await request.get('/api/v1/obras')
  expect(response.status()).toBe(401)

  const payload = await response.json()
  expect(payload.error.code).toBe('UNAUTHORIZED')
  expect(payload.requestId).toBeTruthy()
})

test('docs workspace respeita gate por feature flag (off=404-safe, on=401 sem token)', async ({ request }) => {
  const healthResponse = await request.get('/api/v1/health/ops')
  expect(healthResponse.ok()).toBeTruthy()
  const healthPayload = await healthResponse.json()
  const isEnabled = Boolean(healthPayload?.data?.flags?.docsWorkspaceV1)

  const response = await request.get('/api/v1/docs')
  const payload = await response.json()
  const expectedStatus = isEnabled ? 401 : 404
  const expectedCode = isEnabled ? 'UNAUTHORIZED' : 'NOT_FOUND'

  expect(response.status(), '/api/v1/docs').toBe(expectedStatus)
  expect(payload?.error?.code, '/api/v1/docs').toBe(expectedCode)
  expect(payload?.requestId, '/api/v1/docs').toBeTruthy()
})

test('finance receipts respeita gate por feature flag (off=404-safe, on=401 sem token)', async ({ request }) => {
  const healthResponse = await request.get('/api/v1/health/ops')
  expect(healthResponse.ok()).toBeTruthy()
  const healthPayload = await healthResponse.json()
  const isEnabled = Boolean(healthPayload?.data?.flags?.financeReceiptsV1)

  const checks: Array<{ endpoint: string; method: 'GET' | 'POST' }> = [
    { endpoint: '/api/v1/transacoes/receipts/00000000-0000-0000-0000-000000000000', method: 'GET' },
    { endpoint: '/api/v1/transacoes/receipts/intake', method: 'POST' },
  ]

  for (const check of checks) {
    const response =
      check.method === 'GET'
        ? await request.get(check.endpoint)
        : await request.post(check.endpoint, { data: {} })

    const payload = await response.json()
    const expectedStatus = isEnabled ? 401 : 404
    const expectedCode = isEnabled ? 'UNAUTHORIZED' : 'NOT_FOUND'

    expect(response.status(), check.endpoint).toBe(expectedStatus)
    expect(payload?.error?.code, check.endpoint).toBe(expectedCode)
    expect(payload?.requestId, check.endpoint).toBeTruthy()
  }
})
