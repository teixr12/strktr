export const featureFlags = {
  uiTailadminV1: process.env.NEXT_PUBLIC_FF_UI_TAILADMIN_V1 !== 'false',
  uiV2Obras: process.env.NEXT_PUBLIC_FF_UI_V2_OBRAS === 'true',
  uiV2Leads: process.env.NEXT_PUBLIC_FF_UI_V2_LEADS === 'true',
  uiV2Dashboard: process.env.NEXT_PUBLIC_FF_UI_V2_DASHBOARD === 'true',
  uiV2Financeiro: process.env.NEXT_PUBLIC_FF_UI_V2_FINANCEIRO === 'true',
  uiV2Comercial: process.env.NEXT_PUBLIC_FF_UI_V2_COMERCIAL === 'true',
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
}

export type FeatureFlagKey = keyof typeof featureFlags

export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
  return featureFlags[flag]
}
