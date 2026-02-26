import { expect, test } from '@playwright/test'

test('health endpoint responde', async ({ request }) => {
  const response = await request.get('/api/v1/health/ops')
  expect(response.ok()).toBeTruthy()

  const payload = await response.json()
  expect(payload.data.status).toBeTruthy()
  expect(payload.data.ts).toBeTruthy()
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

test('novos endpoints protegidos retornam envelope canônico sem token', async ({ request }) => {
  const checks: Array<{ endpoint: string; method: 'GET' | 'POST' | 'PATCH' }> = [
    { endpoint: '/api/v1/alerts/today', method: 'GET' },
    { endpoint: '/api/v1/transacoes', method: 'GET' },
    { endpoint: '/api/v1/compras', method: 'GET' },
    { endpoint: '/api/v1/projetos', method: 'GET' },
    { endpoint: '/api/v1/orcamentos', method: 'GET' },
    { endpoint: '/api/v1/equipe', method: 'GET' },
    { endpoint: '/api/v1/visitas', method: 'GET' },
    { endpoint: '/api/v1/knowledgebase', method: 'GET' },
    { endpoint: '/api/v1/notificacoes', method: 'GET' },
    { endpoint: '/api/v1/perfil', method: 'GET' },
    { endpoint: '/api/v1/config/org', method: 'POST' },
    { endpoint: '/api/v1/config/org-members', method: 'POST' },
    { endpoint: '/api/v1/notificacoes/read-all', method: 'POST' },
    { endpoint: '/api/v1/perfil/password', method: 'POST' },
    { endpoint: '/api/v1/perfil', method: 'PATCH' },
  ]

  for (const { endpoint, method } of checks) {
    const response =
      method === 'GET'
        ? await request.get(endpoint)
        : method === 'PATCH'
          ? await request.patch(endpoint, { data: {} })
          : await request.post(endpoint, { data: {} })
    expect(response.status(), endpoint).toBe(401)
    const payload = await response.json()
    expect(payload.error.code, endpoint).toBe('UNAUTHORIZED')
    expect(payload.requestId, endpoint).toBeTruthy()
  }
})
