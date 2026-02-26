import { expect, test } from '@playwright/test'

const E2E_BEARER_TOKEN = process.env.E2E_BEARER_TOKEN || ''
const E2E_OBRA_ID = process.env.E2E_OBRA_ID || ''

test.describe('business flow (authenticated)', () => {
  test.skip(!E2E_BEARER_TOKEN || !E2E_OBRA_ID, 'Set E2E_BEARER_TOKEN and E2E_OBRA_ID to run authenticated business tests')

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

    const compra = await request.post('/api/v1/compras', {
      headers,
      data: {
        descricao: `Compra E2E ${Date.now()}`,
        categoria: 'Material',
        obra_id: E2E_OBRA_ID,
        valor_estimado: 1000,
        urgencia: 'Alta',
        status: 'Solicitado',
        exige_aprovacao_cliente: true,
      },
    })
    expect(compra.status()).toBe(201)
    const compraId = (await compra.json()).data?.id as string
    expect(compraId).toBeTruthy()

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
    const compraApproval = (portalPayload.data?.aprovacoes || []).find((item: { compra?: { id: string } | null }) => item.compra?.id === compraId)
    expect(compraApproval?.id).toBeTruthy()

    const reject = await request.post(`/api/v1/portal/aprovacoes/${compraApproval.id}/reject`, {
      data: {
        token: portalToken,
        comentario: 'Ajustar especificação para aprovar',
      },
    })
    expect(reject.status()).toBe(200)
    const rejectPayload = await reject.json()
    expect(rejectPayload.data?.requiredNextVersion).toBeGreaterThan(1)

    const forceFinalize = await request.put(`/api/v1/compras/${compraId}`, {
      headers,
      data: {
        status: 'Aprovado',
      },
    })
    expect(forceFinalize.status()).toBe(409)

    const resubmit = await request.put(`/api/v1/compras/${compraId}`, {
      headers,
      data: {
        notas: 'Versão revisada para reenvio',
        reenviar_aprovacao_cliente: true,
        exige_aprovacao_cliente: true,
      },
    })
    expect(resubmit.status()).toBe(200)
  })
})
