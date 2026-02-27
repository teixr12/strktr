export const featureFlags = {
  uiTailadminV1: process.env.NEXT_PUBLIC_FF_UI_TAILADMIN_V1 !== 'false',
  uiV2Obras: process.env.NEXT_PUBLIC_FF_UI_V2_OBRAS !== 'false',
  uiV2Leads: process.env.NEXT_PUBLIC_FF_UI_V2_LEADS !== 'false',
  uiV2Dashboard: process.env.NEXT_PUBLIC_FF_UI_V2_DASHBOARD !== 'false',
  uiV2Financeiro: process.env.NEXT_PUBLIC_FF_UI_V2_FINANCEIRO !== 'false',
  uiV2Comercial: process.env.NEXT_PUBLIC_FF_UI_V2_COMERCIAL !== 'false',
  uiV2Compras: process.env.NEXT_PUBLIC_FF_UI_V2_COMPRAS !== 'false',
  uiV2Projetos: process.env.NEXT_PUBLIC_FF_UI_V2_PROJETOS !== 'false',
  uiV2Orcamentos: process.env.NEXT_PUBLIC_FF_UI_V2_ORCAMENTOS !== 'false',
  uiV2Equipe: process.env.NEXT_PUBLIC_FF_UI_V2_EQUIPE !== 'false',
  uiV2Agenda: process.env.NEXT_PUBLIC_FF_UI_V2_AGENDA !== 'false',
  uiV2Knowledgebase: process.env.NEXT_PUBLIC_FF_UI_V2_KB !== 'false',
  uiV2Configuracoes: process.env.NEXT_PUBLIC_FF_UI_V2_CONFIG !== 'false',
  uiV2Perfil: process.env.NEXT_PUBLIC_FF_UI_V2_PERFIL !== 'false',
  uiV2ObraTabs: process.env.NEXT_PUBLIC_FF_UI_V2_OBRA_TABS !== 'false',
  apiObrasV2: process.env.NEXT_PUBLIC_FF_API_OBRAS_V2 === 'true',
  executionRiskEngine:
    process.env.NEXT_PUBLIC_FF_EXECUTION_RISK_ENGINE === 'true',
  executionAlerts: process.env.NEXT_PUBLIC_FF_EXECUTION_ALERTS === 'true',
  checklistDueDate:
    process.env.NEXT_PUBLIC_FF_CHECKLIST_DUE_DATE === 'true',
  productAnalytics: process.env.NEXT_PUBLIC_FF_PRODUCT_ANALYTICS === 'true',
  cronogramaEngine: process.env.NEXT_PUBLIC_FF_CRONOGRAMA_ENGINE === 'true',
  cronogramaPdf: process.env.NEXT_PUBLIC_FF_CRONOGRAMA_PDF === 'true',
  clientPortal: process.env.NEXT_PUBLIC_FF_CLIENT_PORTAL === 'true',
  approvalGate: process.env.NEXT_PUBLIC_FF_APPROVAL_GATE === 'true',
  architectAgenda: process.env.NEXT_PUBLIC_FF_ARCHITECT_AGENDA === 'true',
  personalRoadmap: process.env.NEXT_PUBLIC_FF_PERSONAL_ROADMAP !== 'false',
  semiAutomation: process.env.NEXT_PUBLIC_FF_SEMI_AUTOMATION !== 'false',
  behaviorPrompts: process.env.NEXT_PUBLIC_FF_BEHAVIOR_PROMPTS !== 'false',
}

export type FeatureFlagKey = keyof typeof featureFlags

export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
  return featureFlags[flag]
}
