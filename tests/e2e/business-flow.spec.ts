import { expect, test } from '@playwright/test'

const E2E_BEARER_TOKEN = process.env.E2E_BEARER_TOKEN || ''
const E2E_OBRA_ID = process.env.E2E_OBRA_ID || ''
const isCI = process.env.CI === 'true' || process.env.CI === '1'
const hasRequiredEnv = Boolean(E2E_BEARER_TOKEN && E2E_OBRA_ID)

test.describe('business flow (authenticated)', () => {
  test.beforeAll(() => {
    if (isCI && !hasRequiredEnv) {
      throw new Error('CI must provide E2E_BEARER_TOKEN and E2E_OBRA_ID to run authenticated business flow tests')
    }
  })

  test.skip(!hasRequiredEnv && !isCI, 'Set E2E_BEARER_TOKEN and E2E_OBRA_ID to run authenticated business tests locally')

  test('cronograma -> pdf -> portal approval rejection/resubmission', async ({ request }) => {
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

    const forceFinalize = await request.put(`/api/v1/orcamentos/${orcamentoId}`, {
      headers,
      data: {
        status: 'Aprovado',
      },
    })
    expect(forceFinalize.status()).toBe(409)

    const resubmit = await request.put(`/api/v1/orcamentos/${orcamentoId}`, {
      headers,
      data: {
        observacoes: 'Versão revisada para reenvio',
        reenviar_aprovacao_cliente: true,
        exige_aprovacao_cliente: true,
      },
    })
    expect(resubmit.status()).toBe(200)
  })
})
