import { ok } from '@/lib/api/response'
import { withBillingAuth } from '@/lib/billing/api'
import type {
  BillingChecklistItem,
  BillingOrgProfile,
  BillingProviderStatus,
  BillingReadinessSummary,
  BillingSurface,
} from '@/shared/types/billing'

function hasAnyEnv(keys: string[]): boolean {
  return keys.some((key) => Boolean(process.env[key]?.trim()))
}

function buildProviders(): BillingProviderStatus[] {
  return [
    {
      code: 'stripe',
      label: 'Stripe',
      description: 'Checkout, assinatura, cobrança recorrente e eventos de billing globais.',
      configured: hasAnyEnv(['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']),
      riskLevel: 'high',
      setupState: hasAnyEnv(['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']) ? 'ready' : 'setup_required',
      envKeys: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
      recommendedAction: 'Configurar segredo server-side e validar webhook assinado em staging.',
    },
    {
      code: 'mercadopago',
      label: 'Mercado Pago',
      description: 'Cobrança local, checkout alternativo e aderência ao mercado brasileiro.',
      configured: hasAnyEnv(['MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_WEBHOOK_SECRET']),
      riskLevel: 'high',
      setupState: hasAnyEnv(['MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_WEBHOOK_SECRET']) ? 'ready' : 'setup_required',
      envKeys: ['MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_WEBHOOK_SECRET'],
      recommendedAction: 'Configurar access token, segredo do webhook e fluxo de sandbox.',
    },
  ]
}

function buildChecklist(orgProfile: BillingOrgProfile, providers: BillingProviderStatus[]): BillingChecklistItem[] {
  const webhookReady = providers.some((provider) => provider.configured)
  const distributedRateLimitReady = hasAnyEnv([
    'KV_REST_API_URL',
    'KV_REST_API_TOKEN',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'REDIS_URL',
  ])

  return [
    {
      key: 'org-profile',
      label: 'Perfil fiscal mínimo da organização',
      status: orgProfile.profileReady ? 'ready' : 'blocked',
      detail: orgProfile.profileReady
        ? 'Nome, plano e CNPJ básicos estão presentes para iniciar billing controlado.'
        : 'Sem nome/plano/CNPJ completos, o checkout não deve abrir nem em beta externo.',
    },
    {
      key: 'provider-secrets',
      label: 'Segredos de provedor',
      status: providers.some((provider) => provider.configured) ? 'ready' : 'blocked',
      detail: providers.some((provider) => provider.configured)
        ? 'Pelo menos um provedor de billing tem segredos configurados.'
        : 'Sem provedor pronto, o módulo deve permanecer interno/read-only.',
    },
    {
      key: 'webhook-policy',
      label: 'Webhook assinado e trilha de evento',
      status: webhookReady ? 'ready' : 'blocked',
      detail: webhookReady
        ? 'Existe base de segredo para validar eventos de billing em rollout controlado.'
        : 'Sem webhook pronto não há como reconciliar assinatura e pagamento com segurança.',
    },
    {
      key: 'distributed-rate-limit',
      label: 'Rate limit distribuído',
      status: distributedRateLimitReady ? 'ready' : 'blocked',
      detail: distributedRateLimitReady
        ? 'A infraestrutura suporta rate limit externo para checkout e webhooks.'
        : 'Sem rate limit distribuído, qualquer superfície pública de billing continua bloqueada.',
    },
    {
      key: 'legal-copy',
      label: 'Termos, consentimento e políticas de cobrança',
      status: 'planned',
      detail: 'A camada legal/comercial ainda precisa ser productizada antes do general release.',
    },
  ]
}

function buildSurfaces(providers: BillingProviderStatus[], orgProfile: BillingOrgProfile): BillingSurface[] {
  const providerReady = providers.some((provider) => provider.configured)
  const orgReady = orgProfile.profileReady
  return [
    {
      code: 'transparent-checkout',
      label: 'Checkout transparente',
      description: 'Fluxo de compra com baixo atrito para assinatura da plataforma.',
      exposureState: providerReady && orgReady ? 'setup_required' : 'planned',
      complianceGated: true,
      recommendedAction: 'Abrir só depois de webhook, pricing e textos legais fechados.',
    },
    {
      code: 'subscription-lifecycle',
      label: 'Ciclo de assinatura',
      description: 'Criar, trocar plano, cancelar e recuperar falha de pagamento.',
      exposureState: providerReady ? 'setup_required' : 'planned',
      complianceGated: true,
      recommendedAction: 'Começar com allowlist interna e reconciliação manual assistida.',
    },
    {
      code: 'billing-admin',
      label: 'Administração de cobrança',
      description: 'Visão interna para readiness, planos, provedores e estado operacional.',
      exposureState: 'beta_ready',
      complianceGated: false,
      recommendedAction: 'Usar esta tela como fonte de readiness antes de qualquer rollout write-capable.',
    },
  ]
}

function buildSummary(
  providers: BillingProviderStatus[],
  surfaces: BillingSurface[],
  checklist: BillingChecklistItem[]
): BillingReadinessSummary {
  return {
    totalProviders: providers.length,
    readyProviders: providers.filter((provider) => provider.configured).length,
    setupRequiredProviders: providers.filter((provider) => !provider.configured).length,
    betaReadySurfaces: surfaces.filter((surface) => surface.exposureState === 'beta_ready').length,
    plannedSurfaces: surfaces.filter((surface) => surface.exposureState === 'planned').length,
    complianceGatedSurfaces: surfaces.filter((surface) => surface.complianceGated).length,
    checklistReady: checklist.filter((item) => item.status === 'ready').length,
    checklistBlocked: checklist.filter((item) => item.status === 'blocked').length,
  }
}

export const GET = withBillingAuth('can_manage_team', async (request, { supabase, orgId }) => {
  const { data } = await supabase
    .from('organizacoes')
    .select('nome, cnpj, plano')
    .eq('id', orgId)
    .maybeSingle()

  const orgProfile: BillingOrgProfile = {
    orgName: data?.nome || null,
    plan: data?.plano || null,
    cnpj: data?.cnpj || null,
    profileReady: Boolean(data?.nome?.trim() && data?.plano?.trim() && data?.cnpj?.trim()),
  }

  const providers = buildProviders()
  const checklist = buildChecklist(orgProfile, providers)
  const surfaces = buildSurfaces(providers, orgProfile)

  return ok(request, providers, {
    summary: buildSummary(providers, surfaces, checklist),
    checklist,
    orgProfile,
    surfaces,
  })
})
