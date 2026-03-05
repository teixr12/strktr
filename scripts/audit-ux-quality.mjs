#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const reportDir = path.join(root, 'docs', 'reports')
fs.mkdirSync(reportDir, { recursive: true })

const modules = [
  { name: 'Dashboard', file: 'src/components/dashboard/dashboard-content.tsx' },
  { name: 'Leads', file: 'src/components/leads/leads-content.tsx' },
  { name: 'Financeiro', file: 'src/components/financeiro/financeiro-content.tsx' },
  { name: 'Portal', file: 'src/components/portal/portal-client-view.tsx' },
  { name: 'Notificacoes', file: 'src/components/notificacoes/notificacoes-content.tsx' },
  { name: 'Obras Lista', file: 'src/components/obras/obras-content.tsx' },
  { name: 'Obra Cronograma', file: 'src/components/obras/obra-cronograma.tsx' },
  { name: 'Compras', file: 'src/components/compras/compras-content.tsx' },
  { name: 'Projetos', file: 'src/components/projetos/projetos-content.tsx' },
  { name: 'Calendario', file: 'src/components/calendario/calendario-content.tsx' },
  { name: 'Equipe', file: 'src/components/equipe/equipe-content.tsx' },
  { name: 'Knowledgebase', file: 'src/components/knowledgebase/kb-content.tsx' },
  { name: 'Configuracoes', file: 'src/components/configuracoes/org-settings.tsx' },
  { name: 'Orcamentos', file: 'src/components/orcamentos/orcamentos-content.tsx' },
  { name: 'Perfil', file: 'src/components/perfil/perfil-content.tsx' },
  { name: 'Obra Weather Map Logistics', file: 'src/components/obras/obra-weather-logistics-panel.tsx' },
  { name: 'SOP Builder', file: 'src/components/sops/sops-content.tsx' },
  { name: 'Construction Docs Project', file: 'src/components/construction-docs/project-content.tsx' },
  { name: 'Construction Docs Projects Index', file: 'src/components/construction-docs/projects-index-content.tsx' },
  { name: 'Construction Docs Visit', file: 'src/components/construction-docs/visit-content.tsx' },
  { name: 'Construction Docs Guided Visit', file: 'src/components/construction-docs/visit-guided-content.tsx' },
  { name: 'Construction Docs Document', file: 'src/components/construction-docs/document-content.tsx' },
  { name: 'Docs Workspace', file: 'src/components/docs/docs-workspace-content.tsx' },
]

const checks = {
  loading: /(skeleton|loading|aria-busy)/i,
  empty: /(EmptyStateAction|Nenhum|Sem\s+[a-z])/i,
  errorRetry: /(Tentar novamente|retry|Falha ao carregar|Erro ao carregar)/i,
  feedback: /toast\(/,
}

const rows = []
let criticalFailures = 0
for (const entry of modules) {
  const absPath = path.join(root, entry.file)
  if (!fs.existsSync(absPath)) {
    rows.push({
      module: entry.name,
      file: entry.file,
      loading: false,
      empty: false,
      errorRetry: false,
      feedback: false,
      score: 0,
      notes: 'arquivo ausente',
    })
    criticalFailures += 1
    continue
  }

  const source = fs.readFileSync(absPath, 'utf8')
  const result = {
    loading: checks.loading.test(source),
    empty: checks.empty.test(source),
    errorRetry: checks.errorRetry.test(source),
    feedback: checks.feedback.test(source),
  }
  const score = Object.values(result).filter(Boolean).length
  const notes = []
  if (!result.loading) notes.push('sem estado de loading claro')
  if (!result.feedback) notes.push('sem feedback de ação')
  if (!result.empty) notes.push('empty-state ausente')
  if (!result.errorRetry) notes.push('erro/retry fraco')
  if (!result.loading || !result.feedback) criticalFailures += 1

  rows.push({
    module: entry.name,
    file: entry.file,
    ...result,
    score,
    notes: notes.length ? notes.join('; ') : 'ok',
  })
}

const average = rows.length
  ? (rows.reduce((sum, row) => sum + row.score, 0) / rows.length).toFixed(2)
  : '0.00'
const status = criticalFailures === 0 ? 'pass' : 'warn'

const stamp = new Date().toISOString().replace(/[:]/g, '-').replace(/\..+/, '')
const reportPath = path.join(reportDir, `ux-quality-audit-${stamp}.md`)

const lines = []
lines.push('# UX Quality Audit')
lines.push('')
lines.push(`- GeneratedAt: ${new Date().toISOString()}`)
lines.push(`- Modules: ${rows.length}`)
lines.push(`- AverageScore(0-4): ${average}`)
lines.push(`- CriticalFailures: ${criticalFailures}`)
lines.push(`- Status: ${status}`)
lines.push('')
lines.push('| Módulo | Arquivo | Loading | Empty | Error/Retry | Feedback | Score | Observações |')
lines.push('|---|---|---:|---:|---:|---:|---:|---|')
for (const row of rows) {
  lines.push(
    `| ${row.module} | \`${row.file}\` | ${row.loading ? '1' : '0'} | ${row.empty ? '1' : '0'} | ${row.errorRetry ? '1' : '0'} | ${row.feedback ? '1' : '0'} | ${row.score} | ${row.notes} |`
  )
}

fs.writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8')
console.log(`UX quality audit generated: ${path.relative(root, reportPath)}`)

if (process.env.UX_AUDIT_STRICT === '1' && criticalFailures > 0) {
  console.error('UX quality audit failed in strict mode.')
  process.exit(1)
}
