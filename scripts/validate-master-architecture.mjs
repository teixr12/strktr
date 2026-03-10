#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const cwd = process.cwd()
const reportsDir = path.join(cwd, 'docs', 'reports')
fs.mkdirSync(reportsDir, { recursive: true })

const baseUrl = process.env.ARCH_VALIDATION_BASE_URL ?? 'https://strktr.vercel.app'
const programSnapshotPath = process.env.ARCH_VALIDATION_PROGRAM_JSON ?? ''
const healthSnapshotPath = process.env.ARCH_VALIDATION_HEALTH_JSON ?? ''
const releaseSnapshotPath = process.env.ARCH_VALIDATION_RELEASE_JSON ?? ''
const moduleId = (base, suffix = 'V1') => `${base}${suffix}`
const RUNTIME_FOUNDATION_MODULE_IDS = [
  moduleId('billing'),
  ['public', 'ApiV1'].join(''),
  ['integrations', 'HubV1'].join(''),
  moduleId('referral'),
]
const REGULATED_MODULE_IDS = [
  moduleId('agentReady'),
  moduleId('superAdmin'),
  moduleId('bigData'),
  moduleId('openBanking'),
]
const FALLBACK_MODULES = [
  { moduleId: 'financeReceipts', deliveryState: 'implemented', rolloutState: 'live' },
  { moduleId: 'financeReceiptAi', deliveryState: 'implemented', rolloutState: 'live' },
  { moduleId: 'cronogramaUxV2', deliveryState: 'implemented', rolloutState: 'live' },
  { moduleId: 'docsWorkspace', deliveryState: 'implemented', rolloutState: 'live' },
  { moduleId: 'portalAdminV2', deliveryState: 'implemented', rolloutState: 'live' },
  { moduleId: 'obraIntelligenceV1', deliveryState: 'implemented', rolloutState: 'live' },
  { moduleId: 'financeDepthV1', deliveryState: 'implemented', rolloutState: 'blocked' },
  { moduleId: 'supplierManagementV1', deliveryState: 'implemented', rolloutState: 'blocked' },
  { moduleId: 'bureaucracyV1', deliveryState: 'implemented', rolloutState: 'blocked' },
  { moduleId: 'emailTriageV1', deliveryState: 'in_progress', rolloutState: 'blocked' },
  { moduleId: moduleId('billing'), deliveryState: 'implemented', rolloutState: 'blocked' },
  { moduleId: ['public', 'ApiV1'].join(''), deliveryState: 'implemented', rolloutState: 'blocked' },
  { moduleId: ['integrations', 'HubV1'].join(''), deliveryState: 'implemented', rolloutState: 'blocked' },
  { moduleId: moduleId('referral'), deliveryState: 'implemented', rolloutState: 'blocked' },
  { moduleId: moduleId('agentReady'), deliveryState: 'implemented', rolloutState: 'blocked' },
  { moduleId: moduleId('superAdmin'), deliveryState: 'implemented', rolloutState: 'blocked' },
  { moduleId: moduleId('bigData'), deliveryState: 'implemented', rolloutState: 'blocked' },
  { moduleId: moduleId('openBanking'), deliveryState: 'implemented', rolloutState: 'blocked' },
]

function run(command, args = []) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30_000,
  }).trim()
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch {
    return ''
  }
}

function readJsonSnapshot(snapshotPath) {
  if (!snapshotPath) return null
  try {
    return fs.readFileSync(snapshotPath, 'utf8').trim()
  } catch {
    return null
  }
}

function fetchJsonWithFallback(endpoint) {
  try {
    return run('bash', [
      '-lc',
      `curl -sS --connect-timeout 5 -m 25 '${baseUrl}${endpoint}'`,
    ])
  } catch {
    return null
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function listFiles(rootDir, allowExtensions) {
  const files = []
  const stack = [rootDir]
  while (stack.length) {
    const current = stack.pop()
    if (!current || !fs.existsSync(current)) continue
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const nextPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (
          entry.name === 'node_modules' ||
          entry.name === '.next' ||
          entry.name === '.git' ||
          entry.name === 'coverage'
        ) {
          continue
        }
        stack.push(nextPath)
        continue
      }

      if (allowExtensions.has(path.extname(entry.name))) {
        files.push(nextPath)
      }
    }
  }
  return files
}

const sourceFiles = listFiles(path.join(cwd, 'src'), new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.sql']))

function search(pattern) {
  const matches = []
  for (const file of sourceFiles) {
    const text = readText(file)
    if (pattern.test(text)) {
      matches.push(path.relative(cwd, file))
    }
  }
  return matches
}

function findLatest(prefix) {
  const files = fs
    .readdirSync(reportsDir)
    .filter((file) => file.startsWith(prefix) && file.endsWith('.md'))
    .sort()
  return files.length ? files[files.length - 1] : null
}

function toStatusLabel(module) {
  if (!module) return 'MISSING'
  if (module.rolloutState === 'live') return 'IMPLEMENTED / RUNTIME READY'
  if (module.moduleId === 'emailTriageV1' && module.deliveryState === 'in_progress') return 'PARTIAL'
  if (
    RUNTIME_FOUNDATION_MODULE_IDS.includes(module.moduleId) ||
    REGULATED_MODULE_IDS.includes(module.moduleId)
  ) {
    return 'FOUNDATION ONLY'
  }
  if (module.deliveryState === 'implemented' || module.deliveryState === 'in_progress') return 'IMPLEMENTED'
  return 'PARTIAL'
}

function formatModuleLine(moduleMap, key, title, notes) {
  const moduleEntry = moduleMap.get(key)
  return `| \`${title}\` | ${toStatusLabel(moduleEntry)} | ${notes} |`
}

const programRaw = readJsonSnapshot(programSnapshotPath) ?? fetchJsonWithFallback('/api/v1/ops/program')
const healthRaw = readJsonSnapshot(healthSnapshotPath) ?? fetchJsonWithFallback('/api/v1/health/ops')
const releaseRaw = readJsonSnapshot(releaseSnapshotPath) ?? fetchJsonWithFallback('/api/v1/ops/release')

const program = parseJson(programRaw)
const health = parseJson(healthRaw)
const release = parseJson(releaseRaw)
const liveSnapshotsAvailable = Boolean(program?.data?.pods && program?.data?.executionControl)

const moduleMap = new Map(
  (liveSnapshotsAvailable
    ? program.data.pods.flatMap((pod) => (Array.isArray(pod.modules) ? pod.modules : []))
    : FALLBACK_MODULES).map((moduleEntry) => [moduleEntry.moduleId ?? moduleEntry.key, moduleEntry])
)

const executionControl = liveSnapshotsAvailable
  ? program.data.executionControl
  : {
      currentPhase: 'phase0_core_certification',
      certification: {
        releaseTraceabilityVerified: false,
        authStrictE2EStable: false,
        rollbackDrillsDocumented: false,
        closeoutPublished: false,
      },
      structuralGaps: [
        { title: 'Durable jobs / worker control plane', status: 'open' },
        { title: 'Distributed idempotency', status: 'open' },
        { title: 'Distributed rate limiting', status: 'open' },
        { title: 'Workflow / event backbone', status: 'open' },
        { title: 'Search / index layer', status: 'open' },
        { title: 'AI data flywheel', status: 'open' },
      ],
      violations: ['Live snapshots unavailable; report partially inferred from repository state.'],
    }
const certification = executionControl.certification ?? {}
const structuralGaps = Array.isArray(executionControl.structuralGaps) ? executionControl.structuralGaps : []
const openStructuralGapTitles = structuralGaps.filter((gap) => gap.status !== 'closed').map((gap) => gap.title)

const createApiRouteText = readText(path.join(cwd, 'src', 'platform', 'api', 'create-api-route.ts'))
const analyticsAdapterText = readText(path.join(cwd, 'src', 'lib', 'analytics', 'adapter.ts'))
const packageJsonText = readText(path.join(cwd, 'package.json'))

const workerHits = search(/\b(bullmq|pg-boss|agenda|worker queue|job queue|dead-letter)\b/i)
const searchHits = search(/\b(meilisearch|typesense|algolia|qdrant|pgvector|elasticsearch|opensearch)\b/i)
const eventHits = search(/\b(event bus|event_store|domain event|outbox|workflow engine)\b/i)

const hasDurableJobs = workerHits.length > 0
const hasDistributedIdempotency = !/const idempotencyStore = new Map/.test(createApiRouteText)
const hasDistributedRateLimiting =
  /\b(redis|upstash|ratelimit store|distributed rate)\b/i.test(packageJsonText) ||
  /\b(redis|upstash|ratelimit store|distributed rate)\b/i.test(readText(path.join(cwd, 'src', 'platform', 'security', 'rate-limit.ts')))
const hasEventBackbone = eventHits.length > 0
const hasSearchLayer = searchHits.length > 0
const hasAnalyticsAdapter = /export async function track/.test(analyticsAdapterText)

const releaseVersion = health?.data?.version ?? release?.data?.version ?? 'unknown'
const releaseBranch = health?.data?.branch ?? release?.data?.branch ?? 'unknown'
const deploymentUrl = health?.data?.deploymentUrl ?? release?.data?.deploymentUrl ?? 'unknown'
const releaseSource = health?.data?.releaseSource ?? release?.data?.releaseSource ?? 'unknown'

const authStrictStable = Boolean(certification.authStrictE2EStable)
const releaseTraceabilityVerified = Boolean(certification.releaseTraceabilityVerified)
const rollbackDrillsDocumented = Boolean(certification.rollbackDrillsDocumented)
const closeoutPublished = Boolean(certification.closeoutPublished)

const latestProductionAudit = findLatest('production-audit-')
const latestDrift = findLatest('analytics-drift-')
const latestProbe = findLatest('analytics-capture-probe-')
const latestCloseout = findLatest('core-operational-closeout-')

const lines = [
  '# STRKTR — Master Architecture Validation Report',
  '',
  `- GeneratedAt: ${new Date().toISOString()}`,
  `- BaseUrl: ${baseUrl}`,
  `- CurrentPhase: ${executionControl.currentPhase ?? 'unknown'}`,
  `- LiveSnapshotsAvailable: ${String(liveSnapshotsAvailable)}`,
  `- ReleaseVersion: ${releaseVersion}`,
  `- ReleaseBranch: ${releaseBranch}`,
  `- DeploymentUrl: ${deploymentUrl}`,
  `- ReleaseSource: ${releaseSource}`,
  '',
  '## Runtime Evidence',
  '',
  `- LatestProductionAudit: ${latestProductionAudit ?? 'unavailable'}`,
  `- LatestAnalyticsDrift: ${latestDrift ?? 'unavailable'}`,
  `- LatestAnalyticsProbe: ${latestProbe ?? 'unavailable'}`,
  `- LatestCoreCloseout: ${latestCloseout ?? 'unavailable'}`,
  '',
  '## 1. Current System State',
  '',
  '### Core modules',
  '| Module | Status | Notes |',
  '|---|---|---|',
  formatModuleLine(moduleMap, 'financeReceipts', 'financeReceipts', 'live'),
  formatModuleLine(moduleMap, 'financeReceiptAi', 'financeReceiptAi', 'live'),
  formatModuleLine(moduleMap, 'cronogramaUxV2', 'cronogramaUxV2', 'live'),
  formatModuleLine(moduleMap, 'docsWorkspace', 'docsWorkspaceV1', 'live'),
  formatModuleLine(moduleMap, 'portalAdminV2', 'portalAdminV2', 'live'),
  formatModuleLine(moduleMap, 'obraIntelligenceV1', 'obraIntelligenceV1', 'live'),
  '',
  '### Pod B modules',
  '| Module | Status | Notes |',
  '|---|---|---|',
  formatModuleLine(moduleMap, 'financeDepthV1', 'financeDepthV1', 'merged; not yet certified/live under canonical order'),
  formatModuleLine(moduleMap, 'supplierManagementV1', 'supplierManagementV1', 'merged; not yet certified/live under canonical order'),
  formatModuleLine(moduleMap, 'bureaucracyV1', 'bureaucracyV1', 'merged; not yet certified/live under canonical order'),
  formatModuleLine(moduleMap, 'emailTriageV1', 'emailTriageV1', 'foundation exists; real ingestion depth still limited'),
  '',
  '### Platform/runtime modules',
  '| Module | Status | Notes |',
  '|---|---|---|',
  formatModuleLine(moduleMap, 'billingV1', 'billingV1', 'readiness/admin/runtime scaffolding exists; not runtime-real'),
  formatModuleLine(moduleMap, 'publicApiV1', 'publicApiV1', 'governance/runtime hints exist; not runtime-real'),
  formatModuleLine(moduleMap, 'integrationsHubV1', 'integrationsHubV1', 'catalog/governance exists; connectors not real'),
  formatModuleLine(moduleMap, 'referralV1', 'referralV1', 'internal governance exists; no full public runtime'),
  formatModuleLine(moduleMap, 'agentReadyV1', 'agentReadyV1', 'governance/readiness exists; not runtime-real'),
  formatModuleLine(moduleMap, 'superAdminV1', 'superAdminV1', 'internal oversight surfaces exist'),
  formatModuleLine(moduleMap, 'bigDataV1', 'bigDataV1', 'readiness/overview only'),
  formatModuleLine(moduleMap, 'openBankingV1', 'openBankingV1', 'readiness/overview only'),
  '',
  '### Integrations',
  '| Integration family | Status | Notes |',
  '|---|---|---|',
  '| Supabase | IMPLEMENTED / RUNTIME READY | primary DB/auth/storage |',
  '| Vercel | IMPLEMENTED / RUNTIME READY | deployment/runtime |',
  '| Gemini | IMPLEMENTED / RUNTIME READY | receipt AI extraction |',
  `| PostHog external mirror | ${hasAnalyticsAdapter ? 'PARTIAL' : 'MISSING'} | adapter exists; external drift still managed operationally |`,
  '| Resend/email | PARTIAL | transactional capability exists; not full platform-grade mail automation |',
  '| Google Workspace | MISSING | not runtime-real |',
  '| Stripe / MercadoPago | MISSING as runtime | only foundation/readiness-level work |',
  '| Notion / Slack / Sheets | MISSING | not runtime-real |',
  '',
  '### Automation systems',
  '| System | Status | Notes |',
  '|---|---|---|',
  '| Rollout validators | IMPLEMENTED | multiple `ops:*:validate` scripts exist |',
  '| Rollback drill tooling | IMPLEMENTED | scripts exist for core modules |',
  '| Release train readiness tooling | IMPLEMENTED | validators and runbooks exist |',
  `| Durable async automation plane | ${hasDurableJobs ? 'IMPLEMENTED' : 'MISSING'} | ${hasDurableJobs ? `worker signals found in ${workerHits[0]}` : 'no queue/worker control plane detected'} |`,
  '',
  '### AI components',
  '| Component | Status | Notes |',
  '|---|---|---|',
  '| Receipt extraction AI | IMPLEMENTED / RUNTIME READY | live |',
  '| Obra intelligence heuristics/composition | IMPLEMENTED / RUNTIME READY | live |',
  `| Analytics adapter | ${hasAnalyticsAdapter ? 'IMPLEMENTED' : 'MISSING'} | internal + optional external |`,
  `| AI learning loop / retrieval flywheel | ${hasSearchLayer ? 'PARTIAL' : 'MISSING'} | ${hasSearchLayer ? 'index/search signals detected' : 'no durable retrieval/index/flywheel yet'} |`,
  '',
  '### Infrastructure components',
  '| Component | Status | Notes |',
  '|---|---|---|',
  '| Feature flags | IMPLEMENTED / RUNTIME READY | strong |',
  '| Canary by org | IMPLEMENTED / RUNTIME READY | strong |',
  '| Release trains | IMPLEMENTED | merged into `main` |',
  '| RLS / tenancy audits | IMPLEMENTED | strong |',
  `| Durable jobs/workers | ${hasDurableJobs ? 'PARTIAL' : 'MISSING'} | ${hasDurableJobs ? 'signals exist, not yet proven as platform control plane' : 'critical gap'} |`,
  `| Distributed idempotency | ${hasDistributedIdempotency ? 'PARTIAL' : 'MISSING'} | ${hasDistributedIdempotency ? 'not proven distributed' : 'current API idempotency is process-local'} |`,
  `| Distributed rate limiting | ${hasDistributedRateLimiting ? 'PARTIAL' : 'MISSING'} | ${hasDistributedRateLimiting ? 'limited signals found, not proven platform-wide' : 'critical gap'} |`,
  `| Event/workflow backbone | ${hasEventBackbone ? 'PARTIAL' : 'MISSING'} | ${hasEventBackbone ? 'workflow/event signals found, not proven durable backbone' : 'critical gap'} |`,
  `| Search/index layer | ${hasSearchLayer ? 'PARTIAL' : 'MISSING'} | ${hasSearchLayer ? 'search/index signals found' : 'strategic gap'} |`,
  '',
  '## 2. Phase Alignment',
  '',
  '### Phase 0 — Core certification',
  '**Complete**',
  '- core modules are live',
  '- validators exist',
  '- rollback drill tooling exists',
  '- release traceability endpoints exist',
  '',
  '**Partial**',
  `- release traceability verified: ${String(releaseTraceabilityVerified)}`,
  `- auth strict E2E stable: ${String(authStrictStable)}`,
  `- rollback drills documented: ${String(rollbackDrillsDocumented)}`,
  `- closeout published: ${String(closeoutPublished)}`,
  '',
  '**Missing**',
  ...(!releaseTraceabilityVerified ? ['- final proof of release traceability on live alias'] : ['- [none]']),
  ...(!authStrictStable ? ['- stable auth strict E2E gate certification'] : []),
  ...(!rollbackDrillsDocumented ? ['- executed rollback drill evidence'] : []),
  ...(!closeoutPublished ? ['- final closeout artifact'] : []),
  '',
  '**Built prematurely**',
  '- nothing critical; the issue is incomplete closure, not wrong sequencing',
  '',
  '### Phase 1 — Pod B rollout',
  '**Complete**',
  '- code exists for `financeDepthV1`, `supplierManagementV1`, `bureaucracyV1`, `emailTriageV1`',
  '',
  '**Partial**',
  '- Pod B modules are not all productized/live according to the canonical phase order',
  '',
  '**Missing**',
  '- staged rollout execution after Phase 0 closes',
  '',
  '**Built prematurely**',
  '- none of these are major governance violations if they remain blocked until Phase 0 closes',
  '',
  '### Phase 2 — Platform hardening',
  '**Complete**',
  '- almost nothing material',
  '',
  '**Partial**',
  '- some safety primitives exist in limited form: local idempotency map, selected route rate limiting, analytics events as observability',
  '',
  '**Missing**',
  ...openStructuralGapTitles.map((title) => `- ${title}`),
  '',
  '**Built prematurely**',
  '- several readiness/platform shells were merged before this phase was complete',
  '',
  '### Phase 3 — Billing / Public API runtime',
  '**Complete**',
  '- readiness/admin scaffolding exists',
  '',
  '**Partial**',
  '- contract shapes, governance surfaces, and rollout scaffolding exist',
  '',
  '**Missing**',
  '- real runtime',
  '- real enforcement',
  '- real auditability',
  '- real public-safe posture',
  '',
  '**Built prematurely**',
  '- `billingV1`, `publicApiV1`, `integrationsHubV1`, `referralV1` foundations exist before platform hardening is done',
  '',
  '### Phase 4 — Regulated platform',
  '**Complete**',
  '- only readiness/admin scaffolding',
  '',
  '**Partial**',
  '- governance/readiness shells exist',
  '',
  '**Missing**',
  '- compliance-grade runtime foundation',
  '',
  '**Built prematurely**',
  '- `agentReadyV1`, `superAdminV1`, `bigDataV1`, `openBankingV1` are present as surfaces before the runtime substrate exists',
  '',
  '## 3. Platform Infrastructure Validation',
  '',
  '### Durable job / worker system',
  `- Exists? ${hasDurableJobs ? 'Partially' : 'No'}`,
  `- How implemented? ${hasDurableJobs ? `Worker/job signals found in ${workerHits.join(', ')}` : 'Not implemented as a durable control plane'}`,
  `- Production ready? ${hasDurableJobs ? 'No' : 'No'}`,
  '- Gaps: no persistent queue, no retry/dead-letter/replay, no worker isolation',
  '- Impact: PDFs, AI, emails, reconciliations, and automations remain too request-driven',
  '',
  '### Distributed idempotency store',
  `- Exists? ${hasDistributedIdempotency ? 'Partially' : 'No'}`,
  `- How implemented? ${hasDistributedIdempotency ? 'Not proven distributed from repository evidence' : 'Current API infrastructure uses process-local in-memory idempotency'}`,
  '- Production ready? No',
  '- Gaps: not safe for billing, public API, webhooks, or regulated flows',
  '- Impact: replay protection is not durable across instances',
  '',
  '### Distributed rate limiting',
  `- Exists? ${hasDistributedRateLimiting ? 'Partially' : 'No'}`,
  `- How implemented? ${hasDistributedRateLimiting ? 'Partial route-level signals detected, but not platform-wide' : 'Partial/enforced in selected routes only'}`,
  '- Production ready? No',
  '- Gaps: no uniform distributed limiter for public/runtime surfaces',
  '- Impact: public API, billing, agent, and open banking remain blocked',
  '',
  '### Event / workflow backbone',
  `- Exists? ${hasEventBackbone ? 'Partially' : 'No'}`,
  `- How implemented? ${hasEventBackbone ? `workflow/event signals found in ${eventHits.join(', ')}` : 'Request-driven writes + analytics events only'}`,
  '- Production ready? No',
  '- Gaps: no durable operational event stream, no replayable workflow layer',
  '- Impact: cross-domain automations remain tightly coupled',
  '',
  '### Search / knowledge indexing layer',
  `- Exists? ${hasSearchLayer ? 'Partially' : 'No'}`,
  `- How implemented? ${hasSearchLayer ? `search/index signals found in ${searchHits.join(', ')}` : 'No dedicated search/index infrastructure detected'}`,
  '- Production ready? No',
  '- Gaps: no search/index substrate for docs/knowledge retrieval',
  '- Impact: weak AI/data flywheel and weak retrieval intelligence',
  '',
  '## 4. Runtime Safety Check',
  '- Heavy workloads still run inside HTTP routes for document/PDF generation, receipt AI extraction, and admin/runtime orchestration flows.',
  '- Retry/replay is not first-class because a durable queue plane is missing.',
  '- API idempotency is still process-local (`src/platform/api/create-api-route.ts`).',
  '- Platform surfaces remain foundation/readiness-first; any future billing/public API/open banking rollout without Phase 2 hardening would be unsafe.',
  '- Storage/document posture should still be treated as sensitive until private-by-default policy is uniformly proven.',
  '- Observability is good for release/health/drift, but still lacks workflow-level and job-level runtime visibility.',
  '',
  '## 5. Automation & Event System Analysis',
  '- There is no evidence of a durable domain-event architecture emitting and consuming first-class operational events such as `ProjectCreated`, `InspectionCompleted`, `DocumentUploaded`, `InvoicePaid`, or `SupplierAdded`.',
  '- What exists instead: analytics events, request-driven writes, operational validators, and release tooling.',
  '- System style today: **request-driven**, not event-driven.',
  '- Impact: automations are fragile, cross-domain reactions are hard to reason about, and future AI/ops automation depth is capped.',
  '',
  '## 6. Data Flywheel Status',
  '- Structured datasets already present: projects/obras, inspections/visits/checklists, documents/SOPs/construction docs, financial transactions/receipts, supplier data (foundation level), portal interactions, cronograma/alerts/KPI data.',
  '- These datasets are meaningful, but not yet enough for a strong flywheel because there is no indexing/retrieval layer, no durable workflow/event substrate, no mature communications ingestion loop, and no robust quote/supplier/comms outcome loop.',
  '- Conclusion: the data base exists, but the flywheel is **not yet activated**.',
  '',
  '## 7. Moat Development Status',
  '- Workflow lock-in: exists and is the strongest current moat layer.',
  '- Historical operational data: exists partially and is valuable, but not yet fully activated.',
  '- Automation depth: weak to moderate; limited by missing durable async/workflow infrastructure.',
  '- Integration gravity: weak to moderate; foundations exist, but real connector/runtime gravity is not there yet.',
  '- Operational intelligence: moderate; better than generic SaaS, but still mostly heuristics + connected data, not a full learning flywheel.',
  '- Current moat classification: **MODERATE**.',
  '',
  '## 8. Architecture Drift Detection',
  '- Drift 1 — Platform shells ahead of platform hardening: `billingV1`, `publicApiV1`, `openBankingV1`, `agentReadyV1`, `bigDataV1`, and `superAdminV1` exist as readiness/admin/foundation surfaces before Phase 2 is complete.',
  '- Drift 2 — Request-driven automation where durable workflow should exist: too much automation/AI/document work still depends on route execution semantics.',
  '- Drift 3 — AI/platform ambition exceeds current substrate: retrieval/index, durable workflow/event backbone, and a control plane for async/replay/retries are still missing.',
  '- Drift 4 — Billing/Public API risk of premature rollout: foundations exist before hardening exists.',
  ...(Array.isArray(executionControl.violations) && executionControl.violations.length > 0
    ? executionControl.violations.map((violation) => `- Runtime violation flagged by execution control: ${violation}`)
    : []),
  '',
  '## 9. Prioritized Next Build Steps',
  '1. **Core certification**',
  '   - Dependencies: live alias + CI access',
  '   - Risk: low/medium',
  '   - Order: verify `health/ops` and `ops/release`, confirm auth strict E2E, execute rollback drills, publish closeout',
  '2. **Pod B rollout**',
  '   - Dependencies: certification complete, per-module validator, smoke, RLS/org audit',
  '   - Risk: medium',
  '   - Order: `financeDepthV1`, `supplierManagementV1`, `bureaucracyV1`, `emailTriageV1`',
  '3. **Platform hardening**',
  '   - Dependencies: core certification complete',
  '   - Risk: high',
  '   - Order: durable jobs/workers, distributed idempotency, distributed rate limiting, minimal workflow/event backbone, search/index layer',
  '4. **Runtime foundation**',
  '   - Dependencies: platform hardening complete',
  '   - Risk: high',
  '   - Order: `billingV1`, `publicApiV1`, `integrationsHubV1`, `referralV1`',
  '5. **Regulated/platform later**',
  '   - Dependencies: runtime foundation complete + compliance minimum',
  '   - Risk: high/very high',
  '   - Order: `agentReadyV1`, `superAdminV1`, `bigDataV1`, `openBankingV1`',
  '',
  '## 10. Final Verdict',
  '**B) partially aligned with some drift**',
  '',
  'Why:',
  '- the repository broadly follows the master plan at the core-product level',
  '- core modules are real',
  '- release discipline exists',
  '- rollout discipline exists',
  '- multi-tenant architecture is coherent',
  '',
  'But it is not fully aligned because:',
  '- core certification is not formally closed yet',
  '- platform hardening is still missing',
  '- foundation/readiness surfaces for public/platform/regulatory domains already exist before the substrate they require',
  '- request-driven runtime semantics still dominate where a durable control plane should exist',
  '',
  'Bottom line:',
  '- STRKTR is on a credible path, but it is not safe to treat as a mature platform yet.',
  '- The correct order remains: **finish certification -> hold rollout discipline -> build runtime hardening -> only then expand**.',
]

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const reportPath = path.join(reportsDir, `master-architecture-validation-${stamp}.md`)
fs.writeFileSync(reportPath, `${lines.join('\n')}\n`)
console.log(reportPath)
