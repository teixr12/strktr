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
const RECEIPT_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+KDv1WQAAAABJRU5ErkJggg=='

test.describe('business flow (authenticated)', () => {
  test.beforeAll(() => {
    if (isCI && !hasRequiredEnv) {
      throw new Error('CI must provide E2E_BEARER_TOKEN and E2E_OBRA_ID to run authenticated business flow tests')
    }
    if (isCI && !hasRoleMatrixEnv) {
      throw new Error('CI must provide E2E_MANAGER_BEARER_TOKEN and E2E_USER_BEARER_TOKEN for role matrix checks')
    }
    if (isCI && !hasTenantIsolationEnv) {
      throw new Error('CI must provide E2E_FOREIGN_OBRA_ID for cross-org tenant isolation checks')
    }
  })

  test.skip(!hasRequiredEnv && !isCI, 'Set E2E_BEARER_TOKEN and E2E_OBRA_ID to run authenticated business tests locally')

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

  test('cronograma -> pdf -> portal approval rejection/resubmission', async ({ request }) => {
    test.setTimeout(120_000)

    const headers = {
      Authorization: `Bearer ${E2E_BEARER_TOKEN}`,
    }

    const createItem = await request.post(`/api/v1/obras/${E2E_OBRA_ID}/cronograma/items`, {
      headers,
      data: {
        nome: `E2E item ${Date.now()}`,
        tipo: 'tarefa',
        status: 'pendente',
        duracao_dias: 2,
        empresa_responsavel: 'E2E Ltda',
        responsavel: 'QA',
      },
    })
    expect(createItem.status()).toBe(201)

    const createdItem = (await createItem.json()).data
    expect(createdItem?.id).toBeTruthy()

    const recalc = await request.post(`/api/v1/obras/${E2E_OBRA_ID}/cronograma/recalculate`, {
      headers,
      data: {},
    })
    expect(recalc.status()).toBe(200)

    const pdf = await request.post(`/api/v1/obras/${E2E_OBRA_ID}/cronograma/pdf`, {
      headers,
      data: {},
    })
    expect(pdf.status()).toBe(201)
    const pdfPayload = await pdf.json()
    expect(Boolean(pdfPayload.data.downloadUrl) || Boolean(pdfPayload.data.base64)).toBeTruthy()

    const orcamento = await request.post('/api/v1/orcamentos', {
      headers,
      data: {
        titulo: `Orçamento E2E ${Date.now()}`,
        obra_id: E2E_OBRA_ID,
        status: 'Rascunho',
        exige_aprovacao_cliente: true,
        items: [
          {
            descricao: 'Item E2E',
            unidade: 'un',
            quantidade: 1,
            valor_unitario: 1000,
          },
        ],
      },
    })
    expect(orcamento.status()).toBe(201)
    const orcamentoId = (await orcamento.json()).data?.id as string
    expect(orcamentoId).toBeTruthy()

    const invite = await request.post(`/api/v1/obras/${E2E_OBRA_ID}/portal/invite`, {
      headers,
      data: {
        nome: 'Cliente E2E',
        email: `cliente.e2e.${Date.now()}@example.com`,
        telefone: null,
        expiresInDays: 30,
      },
    })
    expect(invite.status()).toBe(201)
    const invitePayload = await invite.json()
    const portalUrl = invitePayload.data?.portalUrl as string
    expect(portalUrl).toContain('/portal/')
    const portalToken = portalUrl.split('/portal/')[1]
    expect(portalToken).toBeTruthy()

    const portalSession = await request.get(`/api/v1/portal/session/${portalToken}`)
    expect(portalSession.status()).toBe(200)
    const portalPayload = await portalSession.json()
    const approval = (portalPayload.data?.aprovacoes || []).find((item: { orcamento?: { id: string } | null }) => item.orcamento?.id === orcamentoId)
    expect(approval?.id).toBeTruthy()

    const reject = await request.post(`/api/v1/portal/aprovacoes/${approval.id}/reject`, {
      data: {
        token: portalToken,
        comentario: 'Ajustar especificação para aprovar',
      },
    })
    expect(reject.status()).toBe(200)
    const rejectPayload = await reject.json()
    expect(rejectPayload.data?.requiredNextVersion).toBeGreaterThan(1)

    const resubmit = await request.put(`/api/v1/orcamentos/${orcamentoId}`, {
      headers,
      data: {
        observacoes: 'Versão revisada para reenvio',
        reenviar_aprovacao_cliente: true,
        exige_aprovacao_cliente: true,
      },
    })
    expect(resubmit.status()).toBe(200)

    const portalSessionAfterResubmit = await request.get(`/api/v1/portal/session/${portalToken}`)
    expect(portalSessionAfterResubmit.status()).toBe(200)
    const portalAfterPayload = await portalSessionAfterResubmit.json()
    const pendingApproval = (portalAfterPayload.data?.aprovacoes || []).find(
      (item: { orcamento?: { id: string } | null; status: string; approval_version?: number | null }) =>
        item.orcamento?.id === orcamentoId && item.status === 'pendente' && Number(item.approval_version || 0) >= 2
    )
    expect(pendingApproval?.id).toBeTruthy()
  })

  test('finance receipts upload -> link -> list -> delete flow', async ({ request }) => {
    const headers = {
      Authorization: `Bearer ${E2E_BEARER_TOKEN}`,
    }

    const healthResponse = await request.get('/api/v1/health/ops')
    expect(healthResponse.status()).toBe(200)
    const healthPayload = await healthResponse.json()
    const financeReceiptsEnabled = Boolean(healthPayload?.data?.flags?.financeReceiptsV1)

    const uploadResponse = await request.post('/api/v1/transacoes/receipts/intake', {
      headers,
      multipart: {
        run_ai: 'false',
        file: {
          name: 'receipt-e2e.png',
          mimeType: 'image/png',
          buffer: Buffer.from(RECEIPT_PNG_BASE64, 'base64'),
        },
      },
    })

    if (!financeReceiptsEnabled) {
      expect(uploadResponse.status()).toBe(404)
      const disabledPayload = await uploadResponse.json()
      expect(disabledPayload?.error?.code).toBe('NOT_FOUND')
      expect(disabledPayload?.requestId).toBeTruthy()
      return
    }

    expect([201, 404], 'upload should succeed for canary orgs or be hidden outside rollout').toContain(
      uploadResponse.status()
    )

    if (uploadResponse.status() === 404) {
      const rolloutHiddenPayload = await uploadResponse.json()
      expect(rolloutHiddenPayload?.error?.code).toBe('NOT_FOUND')
      expect(rolloutHiddenPayload?.requestId).toBeTruthy()
      return
    }

    const uploadPayload = await uploadResponse.json()
    const intake = uploadPayload.data
    expect(intake?.id).toBeTruthy()
    expect(intake?.signed_url).toBeTruthy()
    expect(intake?.mime_type).toBe('image/png')

    const createResponse = await request.post('/api/v1/transacoes', {
      headers,
      data: {
        obra_id: E2E_OBRA_ID,
        receipt_intake_id: intake.id,
        tipo: 'Despesa',
        categoria: 'Materiais',
        descricao: `Recibo E2E ${Date.now()}`,
        valor: 19.9,
        data: new Date().toISOString().slice(0, 10),
        status: 'Confirmado',
        forma_pagto: 'PIX',
        notas: 'Fluxo E2E receipts',
      },
    })
    expect(createResponse.status()).toBe(201)
    const createdTransaction = (await createResponse.json()).data
    expect(createdTransaction?.id).toBeTruthy()

    const intakeResponse = await request.get(`/api/v1/transacoes/receipts/${intake.id}`, { headers })
    expect(intakeResponse.status()).toBe(200)
    const intakePayload = await intakeResponse.json()
    expect(intakePayload?.data?.transacao_id).toBe(createdTransaction.id)

    const attachmentsResponse = await request.get(`/api/v1/transacoes/${createdTransaction.id}/anexos`, { headers })
    expect(attachmentsResponse.status()).toBe(200)
    const attachmentsPayload = await attachmentsResponse.json()
    expect(Array.isArray(attachmentsPayload?.data?.items)).toBeTruthy()
    expect(attachmentsPayload.data.items).toHaveLength(1)
    expect(attachmentsPayload.data.items[0]?.receipt_intake_id).toBe(intake.id)

    const deleteAttachmentResponse = await request.delete(
      `/api/v1/transacoes/${createdTransaction.id}/anexos/${attachmentsPayload.data.items[0].id}`,
      { headers }
    )
    expect(deleteAttachmentResponse.status()).toBe(200)

    const attachmentsAfterDeleteResponse = await request.get(
      `/api/v1/transacoes/${createdTransaction.id}/anexos`,
      { headers }
    )
    expect(attachmentsAfterDeleteResponse.status()).toBe(200)
    const attachmentsAfterDeletePayload = await attachmentsAfterDeleteResponse.json()
    expect(attachmentsAfterDeletePayload?.data?.items || []).toHaveLength(0)

    const deleteTransactionResponse = await request.delete(`/api/v1/transacoes/${createdTransaction.id}`, {
      headers,
    })
    expect(deleteTransactionResponse.status()).toBe(200)
  })

  test('role matrix enforcement across leads/finance/projects/team', async ({ request }) => {
    test.skip(!hasRoleMatrixEnv && !isCI, 'Set E2E_MANAGER_BEARER_TOKEN and E2E_USER_BEARER_TOKEN to run role matrix checks')

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
    test.skip(!hasTenantIsolationEnv && !isCI, 'Set E2E_FOREIGN_OBRA_ID to validate cross-org isolation checks')

    const headers = {
      Authorization: `Bearer ${E2E_BEARER_TOKEN}`,
    }

    const obraResponse = await request.get(`/api/v1/obras/${E2E_FOREIGN_OBRA_ID}`, { headers })
    expect([403, 404], '/api/v1/obras/:id').toContain(obraResponse.status())

    const summaryResponse = await request.get(`/api/v1/obras/${E2E_FOREIGN_OBRA_ID}/execution-summary`, { headers })
    expect([403, 404], '/api/v1/obras/:id/execution-summary').toContain(summaryResponse.status())
  })
})
