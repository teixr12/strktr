#!/usr/bin/env node
import { execFileSync } from 'node:child_process'

const SHARED_HOTSPOTS = new Set([
  'scripts/audit-ux-quality.mjs',
  'src/app/(app)/layout.tsx',
  'src/components/layout/app-layout-client.tsx',
  'src/components/layout/sidebar.tsx',
  'src/components/ui/command-palette.tsx',
  'supabase/sql/audit_org_id_nulls.sql',
  'supabase/sql/audit_tenancy_rls_status.sql',
])

const TRAIN_A_EXACT = new Set([
  '.gitignore',
  'package.json',
  'scripts/report-release-train-scope.mjs',
  'src/app/api/v1/health/ops/route.ts',
  'src/app/api/v1/ops/program/route.ts',
  'src/lib/feature-flags.ts',
  'src/server/feature-flags/wave2-canary.ts',
  'src/server/program/program-status.ts',
  'src/shared/types/program-status.ts',
  'tests/e2e/smoke.spec.ts',
  'docs/adr/0056-program-rollout-registry-and-ops-status.md',
  'docs/adr/0099-release-train-manifest-v1.md',
  'docs/runbooks/program-100-percent-rollout.md',
  'docs/runbooks/release-train-a-foundation.md',
  'docs/runbooks/release-trains-manifest.md',
])

const TRAIN_B_PREFIXES = [
  'src/app/(app)/burocracia/',
  'src/app/(app)/email-triage/',
  'src/app/(app)/fornecedores/',
  'src/app/(app)/portal-admin/',
  'src/app/api/v1/burocracia/',
  'src/app/api/v1/email-ingest/',
  'src/app/api/v1/financeiro/dre/',
  'src/app/api/v1/fornecedores/',
  'src/app/api/v1/obras/[id]/intelligence/',
  'src/app/api/v1/portal/admin/',
  'src/components/burocracia/',
  'src/components/email-triage/',
  'src/components/fornecedores/',
  'src/components/portal-admin/',
  'src/lib/bureaucracy/',
  'src/lib/email-triage/',
  'src/lib/finance-depth/',
  'src/lib/obra-intelligence/',
  'src/lib/portal-admin-v2/',
  'src/lib/supplier-management/',
  'src/server/services/portal-admin/',
]

const TRAIN_B_EXACT = new Set([
  'src/app/(app)/compras/page.tsx',
  'src/app/(app)/financeiro/page.tsx',
  'src/app/(app)/obras/[id]/page.tsx',
  'src/components/compras/compras-content.tsx',
  'src/components/financeiro/financeiro-content.tsx',
  'src/components/obras/obra-detail-content.tsx',
  'src/components/obras/obra-intelligence-panel.tsx',
  'src/components/obras/obra-portal-admin-tab.tsx',
  'src/components/projetos/projetos-content.tsx',
  'src/shared/types/finance-depth.ts',
  'src/shared/types/obra-intelligence.ts',
  'src/shared/types/portal-admin.ts',
  'src/shared/types/bureaucracy.ts',
  'src/shared/types/email-triage.ts',
  'src/shared/types/supplier-management.ts',
  'src/shared/schemas/bureaucracy.ts',
  'src/shared/schemas/email-triage.ts',
  'src/shared/schemas/supplier-management.ts',
  'supabase/migrations/20260306_bureaucracy_v1.sql',
  'supabase/migrations/20260306_supplier_management_v1.sql',
  'supabase/migrations/20260306_z_email_triage_v1.sql',
  'docs/adr/0057-obra-intelligence-v1.md',
  'docs/adr/0058-supplier-management-v1.md',
  'docs/adr/0059-bureaucracy-v1.md',
  'docs/adr/0060-email-triage-v1.md',
  'docs/adr/0069-portal-admin-v2-dedicated-obra-route.md',
  'docs/adr/0077-portal-admin-v2-project-wrapper.md',
  'docs/adr/0082-portal-admin-v2-obra-activity-drilldown.md',
  'docs/adr/0083-portal-admin-v2-client-activity-drilldown.md',
  'docs/adr/0087-portal-admin-v2-client-sla-approval-drilldown.md',
  'docs/adr/0090-portal-admin-v2-follow-up-state-by-client.md',
  'docs/adr/0092-portal-admin-v2-overdue-approvals-summary-by-obra.md',
  'docs/adr/0093-portal-admin-v2-operational-priority-summary.md',
])

const TRAIN_C_PREFIXES = [
  'src/app/(app)/agent-ready/',
  'src/app/(app)/api-publica/',
  'src/app/(app)/big-data/',
  'src/app/(app)/billing/',
  'src/app/(app)/indicacoes/',
  'src/app/(app)/integracoes/',
  'src/app/(app)/open-banking/',
  'src/app/(app)/super-admin/',
  'src/app/api/v1/agent-ready/',
  'src/app/api/v1/big-data/',
  'src/app/api/v1/billing/',
  'src/app/api/v1/integrations/hub/',
  'src/app/api/v1/open-banking/',
  'src/app/api/v1/public-api/',
  'src/app/api/v1/referrals/',
  'src/app/api/v1/super-admin/',
  'src/components/agent-ready/',
  'src/components/big-data/',
  'src/components/billing/',
  'src/components/indicacoes/',
  'src/components/integracoes/',
  'src/components/open-banking/',
  'src/components/public-api/',
  'src/components/super-admin/',
  'src/lib/agent-ready/',
  'src/lib/big-data/',
  'src/lib/billing/',
  'src/lib/integrations-hub/',
  'src/lib/open-banking/',
  'src/lib/public-api/',
  'src/lib/referral/',
  'src/lib/super-admin/',
  'src/server/services/public-api/',
]

const TRAIN_C_EXACT = new Set([
  'src/shared/types/agent-ready.ts',
  'src/shared/types/big-data.ts',
  'src/shared/types/billing.ts',
  'src/shared/types/integrations-hub.ts',
  'src/shared/types/open-banking.ts',
  'src/shared/types/public-api.ts',
  'src/shared/types/referral.ts',
  'src/shared/types/super-admin.ts',
  'src/shared/schemas/agent-ready.ts',
  'src/shared/schemas/billing.ts',
  'src/shared/schemas/integrations-hub.ts',
  'src/shared/schemas/public-api.ts',
  'src/shared/schemas/referral.ts',
  'supabase/migrations/20260306_referral_v1.sql',
  'supabase/migrations/20260306_z_agent_ready_profiles_v1.sql',
  'supabase/migrations/20260306_z_billing_admin_settings_v1.sql',
  'supabase/migrations/20260306_z_billing_checkout_drafts_v1.sql',
  'supabase/migrations/20260306_z_billing_plan_catalog_v1.sql',
  'supabase/migrations/20260306_z_billing_provider_settings_v1.sql',
  'supabase/migrations/20260306_z_billing_subscription_events_v1.sql',
  'supabase/migrations/20260306_z_billing_subscription_readiness_v1.sql',
  'supabase/migrations/20260306_z_billing_subscription_state_v1.sql',
  'supabase/migrations/20260306_z_integration_provider_settings_v1.sql',
  'supabase/migrations/20260306_z_public_api_client_tokens_v1.sql',
  'supabase/migrations/20260306_z_public_api_client_usage_events_v1.sql',
  'supabase/migrations/20260306_z_public_api_clients_governance_expand.sql',
  'supabase/migrations/20260306_z_public_api_clients_v1.sql',
  'supabase/migrations/20260306_z_public_api_token_quota_overrides_v1.sql',
  'docs/adr/0061-integrations-hub-v1.md',
  'docs/adr/0062-public-api-v1-foundation.md',
  'docs/adr/0063-referral-v1.md',
  'docs/adr/0064-billing-v1-foundation.md',
  'docs/adr/0065-agent-ready-v1-foundation.md',
  'docs/adr/0066-super-admin-v1-foundation.md',
  'docs/adr/0067-big-data-v1-foundation.md',
  'docs/adr/0068-open-banking-v1-foundation.md',
  'docs/adr/0070-billing-v1-staging-write-path.md',
  'docs/adr/0071-public-api-client-governance-v1.md',
  'docs/adr/0072-agent-ready-profile-governance-v1.md',
  'docs/adr/0073-integrations-hub-provider-governance-v1.md',
  'docs/adr/0074-billing-checkout-draft-sandbox-v1.md',
  'docs/adr/0075-public-api-client-governance-expand-v1.md',
  'docs/adr/0076-public-api-client-token-foundation-v1.md',
  'docs/adr/0078-public-api-client-usage-foundation-v1.md',
  'docs/adr/0079-public-api-quota-enforcement-preview-v1.md',
  'docs/adr/0080-public-api-token-quota-preview-v1.md',
  'docs/adr/0081-billing-plan-catalog-v1.md',
  'docs/adr/0084-billing-provider-governance-v1.md',
  'docs/adr/0085-public-api-token-quota-preview-v1.md',
  'docs/adr/0086-billing-subscription-readiness-v1.md',
  'docs/adr/0088-billing-subscription-state-v1.md',
  'docs/adr/0089-billing-subscription-events-v1.md',
  'docs/adr/0091-public-api-token-request-block-preview-v1.md',
  'docs/adr/0094-billing-operational-summary-v1.md',
  'docs/adr/0095-super-admin-billing-governance-v1.md',
  'docs/adr/0096-super-admin-rollout-governance-v1.md',
  'docs/adr/0097-super-admin-domain-health-v1.md',
  'docs/adr/0098-super-admin-compliance-gates-v1.md',
])

function runGit(args) {
  return execFileSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
}

function parseGitStatus() {
  const output = runGit(['status', '--porcelain=v1', '--untracked-files=all'])
  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => ({
      raw: line,
      status: line.slice(0, 2),
      path: line.slice(3).trim(),
    }))
}

function matchesPrefix(path, prefixes) {
  return prefixes.some((prefix) => path.startsWith(prefix))
}

function classify(path) {
  if (path.startsWith('docs/reports/') || path.startsWith('.claude/')) return 'ignored'
  if (SHARED_HOTSPOTS.has(path)) return 'shared-hotspots'
  if (TRAIN_A_EXACT.has(path)) return 'train-a'
  if (TRAIN_B_EXACT.has(path) || matchesPrefix(path, TRAIN_B_PREFIXES)) return 'train-b'
  if (TRAIN_C_EXACT.has(path) || matchesPrefix(path, TRAIN_C_PREFIXES)) return 'train-c'
  return 'unclassified'
}

function toSectionTitle(bucket) {
  switch (bucket) {
    case 'train-a':
      return 'Train A'
    case 'train-b':
      return 'Train B'
    case 'train-c':
      return 'Train C'
    case 'shared-hotspots':
      return 'Shared Hotspots'
    case 'ignored':
      return 'Ignored'
    default:
      return 'Unclassified'
  }
}

function renderMarkdown(entriesByBucket) {
  const order = ['train-a', 'train-b', 'train-c', 'shared-hotspots', 'ignored', 'unclassified']
  const lines = ['# Release Train Scope', '']

  for (const bucket of order) {
    const entries = entriesByBucket.get(bucket) || []
    lines.push(`## ${toSectionTitle(bucket)} (${entries.length})`)
    if (entries.length === 0) {
      lines.push('- none', '')
      continue
    }
    for (const entry of entries) {
      lines.push(`- \`${entry.status}\` ${entry.path}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

const entries = parseGitStatus()
const byBucket = new Map()
for (const entry of entries) {
  const bucket = classify(entry.path)
  const list = byBucket.get(bucket) || []
  list.push(entry)
  byBucket.set(bucket, list)
}

const isJson = process.argv.includes('--json')
if (isJson) {
  const json = {}
  for (const [bucket, list] of byBucket.entries()) {
    json[bucket] = list
  }
  process.stdout.write(`${JSON.stringify(json, null, 2)}\n`)
} else {
  process.stdout.write(`${renderMarkdown(byBucket)}\n`)
}
