function normalizeFlag(value: string | undefined): string {
  return (value || '').trim().toLowerCase()
}

export function isFlagEnabledByDefault(value: string | undefined): boolean {
  return normalizeFlag(value) !== 'false'
}

export function isFlagDisabledByDefault(value: string | undefined): boolean {
  return normalizeFlag(value) === 'true'
}

export const featureFlags = {
  uiTailadminV1: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_TAILADMIN_V1),
  uiV2Obras: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_V2_OBRAS),
  uiV2Leads: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_V2_LEADS),
  uiV2Dashboard: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_V2_DASHBOARD),
  uiV2Financeiro: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_V2_FINANCEIRO),
  uiV2Comercial: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_V2_COMERCIAL),
  uiV2Compras: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_V2_COMPRAS),
  uiV2Projetos: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_V2_PROJETOS),
  uiV2Orcamentos: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_V2_ORCAMENTOS),
  uiV2Equipe: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_V2_EQUIPE),
  uiV2Agenda: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_V2_AGENDA),
  uiV2Knowledgebase: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_V2_KB),
  uiV2Configuracoes: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_V2_CONFIG),
  uiV2Perfil: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_V2_PERFIL),
  uiV2ObraTabs: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_V2_OBRA_TABS),
  profileAvatarV2: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_PROFILE_AVATAR_V2),
  navCountsV2: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_NAV_COUNTS_V2),
  leadsProgressV2: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_LEADS_PROGRESS_V2),
  orcamentoPdfV2: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_ORCAMENTO_PDF_V2),
  uiPaginationV1: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_PAGINATION_V1),
  tableVirtualization: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_TABLE_VIRTUALIZATION),
  apiObrasV2: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_API_OBRAS_V2),
  executionRiskEngine: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_EXECUTION_RISK_ENGINE),
  executionAlerts: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_EXECUTION_ALERTS),
  checklistDueDate: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_CHECKLIST_DUE_DATE),
  productAnalytics: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_PRODUCT_ANALYTICS),
  analyticsExternalV1: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_ANALYTICS_EXTERNAL_V1),
  cronogramaEngine: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_CRONOGRAMA_ENGINE),
  cronogramaViewsV1: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_CRONOGRAMA_VIEWS_V1),
  cronogramaPdf: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_CRONOGRAMA_PDF),
  clientPortal: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_CLIENT_PORTAL),
  approvalGate: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_APPROVAL_GATE),
  architectAgenda: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_ARCHITECT_AGENDA),
  personalRoadmap: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_PERSONAL_ROADMAP),
  semiAutomation: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_SEMI_AUTOMATION),
  behaviorPrompts: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_BEHAVIOR_PROMPTS),
  cmdPalette: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_CMD_PALETTE),
  dashboardSsrV2: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_DASHBOARD_SSR_V2),
}

export type FeatureFlagKey = keyof typeof featureFlags

export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
  return featureFlags[flag]
}
