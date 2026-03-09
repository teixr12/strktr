import { expect, test } from '@playwright/test'

const E2E_BEARER_TOKEN = process.env.E2E_BEARER_TOKEN || ''
const E2E_OBRA_ID = process.env.E2E_OBRA_ID || ''
const E2E_MANAGER_BEARER_TOKEN = process.env.E2E_MANAGER_BEARER_TOKEN || ''
const E2E_USER_BEARER_TOKEN = process.env.E2E_USER_BEARER_TOKEN || ''
const E2E_FOREIGN_OBRA_ID = process.env.E2E_FOREIGN_OBRA_ID || ''
const isCI = process.env.CI === 'true' || process.env.CI === '1'
const hasRequiredEnv = Boolean(E2E_BEARER_TOKEN && E2E_OBRA_ID)
const hasRoleMatrixEnv = Boolean(E2E_MANAGER_BEARER_TOKEN && E2E_USER_BEARER_TOKEN)
const hasTenantIsolationEnv = Boolean(E2E_FOREIGN_OBRA_ID)

test.describe('auth strict core', () => {
  test.beforeAll(() => {
    if (isCI && !hasRequiredEnv) {
      throw new Error('CI must provide E2E_BEARER_TOKEN and E2E_OBRA_ID to run authenticated strict tests')
    }
    if (isCI && !hasRoleMatrixEnv) {
      throw new Error('CI must provide E2E_MANAGER_BEARER_TOKEN and E2E_USER_BEARER_TOKEN for role matrix checks')
    }
    if (isCI && !hasTenantIsolationEnv) {
      throw new Error('CI must provide E2E_FOREIGN_OBRA_ID for cross-org tenant isolation checks')
    }
  })

  test.skip(!hasRequiredEnv && !isCI, 'Set strict auth envs to run authenticated strict tests locally')

  test('list endpoints expose stable pagination meta', async ({ request }) => {
    const headers = {
      Authorization: `Bearer ${E2E_BEARER_TOKEN}`,
    }

    const routes = [
      '/api/v1/leads?page=1&pageSize=5',
      '/api/v1/compras?page=1&pageSize=5',
      '/api/v1/transacoes?page=1&pageSize=5',
      '/api/v1/projetos?page=1&pageSize=5',
      '/api/v1/orcamentos?page=1&pageSize=5',
    ]

    for (const route of routes) {
      const response = await request.get(route, { headers })
      expect(response.status()).toBe(200)
      const payload = await response.json()
      expect(Array.isArray(payload.data)).toBeTruthy()
      expect(payload.meta.page).toBe(1)
      expect(payload.meta.pageSize).toBe(5)
      expect(typeof payload.meta.total).toBe('number')
      expect(typeof payload.meta.hasMore).toBe('boolean')
      expect(typeof payload.meta.count).toBe('number')
    }
  })

  test('role matrix enforcement across leads finance projects and team', async ({ request }) => {
    test.skip(!hasRoleMatrixEnv && !isCI, 'Set role matrix envs to run strict role checks locally')

    const managerHeaders = {
      Authorization: `Bearer ${E2E_MANAGER_BEARER_TOKEN}`,
    }
    const userHeaders = {
      Authorization: `Bearer ${E2E_USER_BEARER_TOKEN}`,
    }

    const managerFinance = await request.get('/api/v1/transacoes?page=1&pageSize=5', { headers: managerHeaders })
    expect(managerFinance.status()).toBe(200)

    const managerProjects = await request.get('/api/v1/projetos?page=1&pageSize=5', { headers: managerHeaders })
    expect(managerProjects.status()).toBe(200)

    const managerTeam = await request.get('/api/v1/equipe', { headers: managerHeaders })
    expect(managerTeam.status()).toBe(200)

    const userLeads = await request.get('/api/v1/leads?page=1&pageSize=5', { headers: userHeaders })
    expect(userLeads.status()).toBe(200)

    const userFinance = await request.get('/api/v1/transacoes?page=1&pageSize=5', { headers: userHeaders })
    expect(userFinance.status()).toBe(403)

    const userProjects = await request.get('/api/v1/projetos?page=1&pageSize=5', { headers: userHeaders })
    expect(userProjects.status()).toBe(403)

    const userTeam = await request.get('/api/v1/equipe', { headers: userHeaders })
    expect(userTeam.status()).toBe(403)
  })

  test('tenant isolation blocks access to foreign obra', async ({ request }) => {
    test.skip(!hasTenantIsolationEnv && !isCI, 'Set foreign obra env to validate cross-org isolation locally')

    const headers = {
      Authorization: `Bearer ${E2E_BEARER_TOKEN}`,
    }

    const obraResponse = await request.get(`/api/v1/obras/${E2E_FOREIGN_OBRA_ID}`, { headers })
    expect([403, 404], '/api/v1/obras/:id').toContain(obraResponse.status())

    const summaryResponse = await request.get(`/api/v1/obras/${E2E_FOREIGN_OBRA_ID}/execution-summary`, { headers })
    expect([403, 404], '/api/v1/obras/:id/execution-summary').toContain(summaryResponse.status())
  })
})
