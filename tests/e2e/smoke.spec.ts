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
  const checks: Array<{ endpoint: string; method: 'GET' | 'POST' | 'PATCH' | 'DELETE' }> = [
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
    { endpoint: '/api/v1/agenda/arquiteto', method: 'GET' },
    { endpoint: '/api/v1/obras/00000000-0000-0000-0000-000000000000/cronograma', method: 'GET' },
    { endpoint: '/api/v1/obras/00000000-0000-0000-0000-000000000000/cronograma/recalculate', method: 'POST' },
    { endpoint: '/api/v1/obras/00000000-0000-0000-0000-000000000000/cronograma/pdf', method: 'POST' },
    { endpoint: '/api/v1/obras/00000000-0000-0000-0000-000000000000/kpis', method: 'GET' },
    { endpoint: '/api/v1/obras/00000000-0000-0000-0000-000000000000/alerts', method: 'GET' },
    { endpoint: '/api/v1/obras/00000000-0000-0000-0000-000000000000/weather', method: 'GET' },
    { endpoint: '/api/v1/obras/00000000-0000-0000-0000-000000000000/location', method: 'GET' },
    { endpoint: '/api/v1/obras/00000000-0000-0000-0000-000000000000/location', method: 'PATCH' },
    { endpoint: '/api/v1/obras/00000000-0000-0000-0000-000000000000/logistics/estimate', method: 'POST' },
    { endpoint: '/api/v1/obras/00000000-0000-0000-0000-000000000000/portal/invite', method: 'POST' },
    { endpoint: '/api/v1/portal/admin/settings?obra_id=00000000-0000-0000-0000-000000000000', method: 'GET' },
    { endpoint: '/api/v1/portal/admin/settings?obra_id=00000000-0000-0000-0000-000000000000', method: 'PATCH' },
    { endpoint: '/api/v1/portal/admin/invites/00000000-0000-0000-0000-000000000000/regenerate', method: 'POST' },
    { endpoint: '/api/v1/general-tasks', method: 'GET' },
    { endpoint: '/api/v1/general-tasks/assignees', method: 'GET' },
    { endpoint: '/api/v1/general-tasks', method: 'POST' },
    { endpoint: '/api/v1/general-tasks/00000000-0000-0000-0000-000000000000', method: 'PATCH' },
    { endpoint: '/api/v1/general-tasks/00000000-0000-0000-0000-000000000000/assign', method: 'POST' },
    { endpoint: '/api/v1/sops', method: 'GET' },
    { endpoint: '/api/v1/sops', method: 'POST' },
    { endpoint: '/api/v1/sops/00000000-0000-0000-0000-000000000000', method: 'PATCH' },
    { endpoint: '/api/v1/sops/00000000-0000-0000-0000-000000000000', method: 'DELETE' },
    { endpoint: '/api/v1/sops/00000000-0000-0000-0000-000000000000/export/pdf', method: 'POST' },
    { endpoint: '/api/v1/sops/00000000-0000-0000-0000-000000000000/share/whatsapp', method: 'POST' },
    { endpoint: '/api/v1/sops/00000000-0000-0000-0000-000000000000/send-email', method: 'POST' },
  ]

  for (const { endpoint, method } of checks) {
    const response =
      method === 'GET'
        ? await request.get(endpoint)
        : method === 'DELETE'
          ? await request.delete(endpoint, { data: {} })
        : method === 'PATCH'
          ? await request.patch(endpoint, { data: {} })
          : await request.post(endpoint, { data: {} })
    expect(response.status(), endpoint).toBe(401)
    const payload = await response.json()
    expect(payload.error.code, endpoint).toBe('UNAUTHORIZED')
    expect(payload.requestId, endpoint).toBeTruthy()
  }
})

test('construction docs respeita gate por feature flag (off=404-safe, on=401 sem token)', async ({ request }) => {
  const healthResponse = await request.get('/api/v1/health/ops')
  expect(healthResponse.ok()).toBeTruthy()
  const healthPayload = await healthResponse.json()
  const isEnabled = Boolean(healthPayload?.data?.flags?.constructionDocs)

  const checks: Array<{ endpoint: string; method: 'GET' | 'POST' }> = [
    { endpoint: '/api/v1/construction-docs/projects', method: 'GET' },
    { endpoint: '/api/v1/construction-docs/templates', method: 'GET' },
    { endpoint: '/api/v1/construction-docs/projects/00000000-0000-0000-0000-000000000000/visits', method: 'GET' },
    { endpoint: '/api/v1/construction-docs/documents/generate/inspection', method: 'POST' },
    { endpoint: '/api/v1/construction-docs/documents/generate/schedule', method: 'POST' },
    { endpoint: '/api/v1/construction-docs/documents/generate/sop', method: 'POST' },
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

  const publicShareResponse = await request.get('/api/v1/construction-docs/share/token-invalido')
  expect(publicShareResponse.status(), '/api/v1/construction-docs/share/:token').toBe(404)
  const publicSharePayload = await publicShareResponse.json()
  expect(publicSharePayload?.error?.code, '/api/v1/construction-docs/share/:token').toBe('NOT_FOUND')
  expect(publicSharePayload?.requestId, '/api/v1/construction-docs/share/:token').toBeTruthy()
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

test('portal público exige token válido e retorna envelope de erro', async ({ request }) => {
  const endpoints: Array<{ endpoint: string; method: 'GET' | 'POST'; body?: Record<string, unknown> }> = [
    { endpoint: '/api/v1/portal/session/token-invalido', method: 'GET' },
    { endpoint: '/api/v1/portal/comentarios', method: 'POST', body: { token: 'inv', mensagem: 'x' } },
    { endpoint: '/api/v1/portal/aprovacoes/00000000-0000-0000-0000-000000000000/approve', method: 'POST', body: { token: 'inv' } },
    { endpoint: '/api/v1/portal/aprovacoes/00000000-0000-0000-0000-000000000000/reject', method: 'POST', body: { token: 'inv', comentario: 'x' } },
  ]

  for (const entry of endpoints) {
    const response =
      entry.method === 'GET'
        ? await request.get(entry.endpoint)
        : await request.post(entry.endpoint, { data: entry.body || {} })

    expect([400, 401, 500], entry.endpoint).toContain(response.status())
    const payload = await response.json()
    expect(payload.requestId, entry.endpoint).toBeTruthy()
  }
})

test('endpoints legados mantêm compatibilidade e requestId', async ({ request }) => {
  const aiResponse = await request.post('/api/ai/calculate', {
    data: { tipoProjeto: 'Residencial', areaM2: 120, local: 'SP' },
  })
  expect([401, 503], '/api/ai/calculate').toContain(aiResponse.status())
  const aiPayload = await aiResponse.json()
  expect(typeof aiPayload.error, '/api/ai/calculate error type').toBe('string')
  expect(aiPayload.requestId, '/api/ai/calculate requestId').toBeTruthy()
  expect(aiPayload.errorDetail?.code, '/api/ai/calculate errorDetail').toBeTruthy()

  const webhooksResponse = await request.post('/api/webhooks', { data: {} })
  expect([400, 403], '/api/webhooks').toContain(webhooksResponse.status())
  const webhooksPayload = await webhooksResponse.json()
  expect(typeof webhooksPayload.error, '/api/webhooks error type').toBe('string')
  expect(webhooksPayload.requestId, '/api/webhooks requestId').toBeTruthy()
  expect(webhooksPayload.errorDetail?.code, '/api/webhooks errorDetail').toBeTruthy()

  const whatsappVerify = await request.get('/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=invalid&hub.challenge=test')
  expect(whatsappVerify.status(), '/api/whatsapp/webhook verify').toBe(403)
  const whatsappVerifyPayload = await whatsappVerify.json()
  expect(typeof whatsappVerifyPayload.error, '/api/whatsapp/webhook verify error type').toBe('string')
  expect(whatsappVerifyPayload.requestId, '/api/whatsapp/webhook verify requestId').toBeTruthy()
  expect(whatsappVerifyPayload.errorDetail?.code, '/api/whatsapp/webhook verify errorDetail').toBeTruthy()
})
