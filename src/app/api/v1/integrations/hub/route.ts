import { ok } from '@/lib/api/response'
import { withIntegrationsHubAuth } from '@/lib/integrations-hub/api'
import type { IntegrationHubItem, IntegrationHubSummary } from '@/shared/types/integrations-hub'

function hasAnyEnv(keys: string[]): boolean {
  return keys.some((key) => Boolean(process.env[key]?.trim()))
}

function buildItems(): IntegrationHubItem[] {
  return [
    {
      code: 'whatsapp_business',
      label: 'WhatsApp Business',
      description: 'Notificações, atendimento e fluxos SDR via WhatsApp.',
      category: 'communication',
      configured: hasAnyEnv(['WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_API_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID']),
      configuredBy: 'environment',
      riskLevel: 'medium',
      setupState: hasAnyEnv(['WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_API_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID']) ? 'ready' : 'setup_required',
      recommendedAction: 'Configurar tokens da Meta e validar webhook.',
      envKeys: ['WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_API_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'],
    },
    {
      code: 'google_calendar',
      label: 'Google Calendar',
      description: 'Sincronização de tarefas, visitas e cronograma com calendário.',
      category: 'calendar',
      configured: hasAnyEnv(['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALENDAR_ID']),
      configuredBy: 'environment',
      riskLevel: 'medium',
      setupState: hasAnyEnv(['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALENDAR_ID']) ? 'ready' : 'setup_required',
      recommendedAction: 'Conectar credenciais OAuth e calendário padrão.',
      envKeys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALENDAR_ID'],
    },
    {
      code: 'resend',
      label: 'Resend',
      description: 'Entrega de emails transacionais da plataforma.',
      category: 'communication',
      configured: hasAnyEnv(['RESEND_API_KEY', 'RESEND_FROM_EMAIL']),
      configuredBy: 'environment',
      riskLevel: 'low',
      setupState: hasAnyEnv(['RESEND_API_KEY', 'RESEND_FROM_EMAIL']) ? 'ready' : 'setup_required',
      recommendedAction: 'Definir remetente transacional e chave de API.',
      envKeys: ['RESEND_API_KEY', 'RESEND_FROM_EMAIL'],
    },
    {
      code: 'posthog',
      label: 'PostHog',
      description: 'Mirror externo de analytics e diagnóstico de produto.',
      category: 'analytics',
      configured: hasAnyEnv(['NEXT_PUBLIC_POSTHOG_KEY', 'NEXT_PUBLIC_POSTHOG_HOST']),
      configuredBy: 'environment',
      riskLevel: 'low',
      setupState: hasAnyEnv(['NEXT_PUBLIC_POSTHOG_KEY', 'NEXT_PUBLIC_POSTHOG_HOST']) ? 'ready' : 'setup_required',
      recommendedAction: 'Configurar host e token do projeto.',
      envKeys: ['NEXT_PUBLIC_POSTHOG_KEY', 'NEXT_PUBLIC_POSTHOG_HOST'],
    },
    {
      code: 'stripe',
      label: 'Stripe',
      description: 'Billing, planos, checkout e cobrança recorrente.',
      category: 'billing',
      configured: hasAnyEnv(['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']),
      configuredBy: 'environment',
      riskLevel: 'high',
      setupState: hasAnyEnv(['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']) ? 'ready' : 'setup_required',
      recommendedAction: 'Configurar segredo server-side e webhook assinado.',
      envKeys: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    },
    {
      code: 'mercadopago',
      label: 'Mercado Pago',
      description: 'Cobrança local e checkout alternativo para billing.',
      category: 'billing',
      configured: hasAnyEnv(['MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_WEBHOOK_SECRET']),
      configuredBy: 'environment',
      riskLevel: 'high',
      setupState: hasAnyEnv(['MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_WEBHOOK_SECRET']) ? 'ready' : 'setup_required',
      recommendedAction: 'Configurar access token e validar webhook.',
      envKeys: ['MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_WEBHOOK_SECRET'],
    },
    {
      code: 'notion',
      label: 'Notion',
      description: 'Exportação e sincronização de documentos e bases externas.',
      category: 'documents',
      configured: hasAnyEnv(['NOTION_API_KEY']),
      configuredBy: 'environment',
      riskLevel: 'medium',
      setupState: hasAnyEnv(['NOTION_API_KEY']) ? 'ready' : 'setup_required',
      recommendedAction: 'Adicionar integração interna e token do workspace.',
      envKeys: ['NOTION_API_KEY'],
    },
    {
      code: 'slack',
      label: 'Slack',
      description: 'Alertas, eventos operacionais e handoff de times.',
      category: 'communication',
      configured: hasAnyEnv(['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET']),
      configuredBy: 'environment',
      riskLevel: 'medium',
      setupState: hasAnyEnv(['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET']) ? 'ready' : 'setup_required',
      recommendedAction: 'Configurar app do Slack e segredo de assinatura.',
      envKeys: ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET'],
    },
    {
      code: 'google_sheets',
      label: 'Google Sheets',
      description: 'Exportação de dados estruturados e relatórios formatados.',
      category: 'documents',
      configured: hasAnyEnv(['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']),
      configuredBy: 'environment',
      riskLevel: 'low',
      setupState: hasAnyEnv(['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']) ? 'ready' : 'setup_required',
      recommendedAction: 'Reutilizar OAuth do Google e definir escopos de planilha.',
      envKeys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    },
    {
      code: 'webhooks',
      label: 'Webhooks',
      description: 'Saída e ingestão de eventos externos com assinatura.',
      category: 'automation',
      configured: hasAnyEnv(['WEBHOOK_SHARED_TOKEN']),
      configuredBy: 'environment',
      riskLevel: 'medium',
      setupState: hasAnyEnv(['WEBHOOK_SHARED_TOKEN']) ? 'ready' : 'setup_required',
      recommendedAction: 'Definir token compartilhado e política de replay.',
      envKeys: ['WEBHOOK_SHARED_TOKEN'],
    },
    {
      code: 'sicoob_api',
      label: 'Sicoob API',
      description: 'Integração financeira e conciliação bancária.',
      category: 'finance',
      configured: hasAnyEnv(['SICOOB_CLIENT_ID', 'SICOOB_CLIENT_SECRET', 'SICOOB_TOKEN_URL']),
      configuredBy: 'environment',
      riskLevel: 'high',
      setupState: hasAnyEnv(['SICOOB_CLIENT_ID', 'SICOOB_CLIENT_SECRET', 'SICOOB_TOKEN_URL']) ? 'ready' : 'setup_required',
      recommendedAction: 'Configurar credenciais e fluxo de autenticação bancária.',
      envKeys: ['SICOOB_CLIENT_ID', 'SICOOB_CLIENT_SECRET', 'SICOOB_TOKEN_URL'],
    },
  ]
}

function buildSummary(items: IntegrationHubItem[]): IntegrationHubSummary {
  return {
    total: items.length,
    configured: items.filter((item) => item.configured).length,
    setupRequired: items.filter((item) => !item.configured).length,
    communication: items.filter((item) => item.category === 'communication').length,
    billing: items.filter((item) => item.category === 'billing').length,
    analytics: items.filter((item) => item.category === 'analytics').length,
  }
}

export const GET = withIntegrationsHubAuth('can_manage_team', async (request) => {
  const items = buildItems()
  return ok(request, items, { summary: buildSummary(items) })
})
