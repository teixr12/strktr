#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const cwd = process.cwd()
const now = new Date()
const timestamp = now.toISOString().replace(/[:.]/g, '-')
const skipRemote = process.env.FINANCE_RECEIPTS_PROMOTION_SKIP_REMOTE === '1'

function run(command, { allowSkip = false } = {}) {
  if (skipRemote && allowSkip) {
    return { ok: true, skipped: true, output: 'skipped by FINANCE_RECEIPTS_PROMOTION_SKIP_REMOTE=1' }
  }

  try {
    const output = execSync(command, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { ok: true, skipped: false, output: output.trim() }
  } catch (error) {
    const stdout = error.stdout?.toString?.() || ''
    const stderr = error.stderr?.toString?.() || ''
    return {
      ok: false,
      skipped: false,
      output: [stdout, stderr].filter(Boolean).join('\n').trim(),
    }
  }
}

const checks = [
  ['Finance Receipts Flow', 'npm run ops:finance-receipts:validate', false],
  ['Production Audit', './scripts/run-production-audits.sh', true],
  ['Analytics Drift', './scripts/audit-analytics-drift.sh', true],
  ['Capture Probe', './scripts/audit-analytics-capture-probe.sh', true],
]

const results = checks.map(([label, command, allowSkip]) => ({
  label,
  command,
  ...run(command, { allowSkip }),
}))

const reportLines = [
  '# Finance Receipts Promotion Readiness',
  '',
  `- Generated at: ${now.toISOString()}`,
  `- SkipRemote: ${skipRemote ? 'true' : 'false'}`,
  '- Scope: readiness gate before promoting `financeReceipts` from the current stage to the next.',
  '',
  '## Checks',
  '',
  '| Check | Status | Command |',
  '|---|---|---|',
]

for (const result of results) {
  const status = result.skipped ? 'skip' : result.ok ? 'pass' : 'fail'
  reportLines.push(`| ${result.label} | ${status} | \`${result.command}\` |`)
}

reportLines.push(
  '',
  '## Manual Preconditions',
  '',
  '1. Current `financeReceipts` window is stable enough to evaluate promotion.',
  '2. `financeReceiptAiV1` remains `OFF`.',
  '3. No other module is being promoted in production.',
  '4. If promoting to `100%`, the `25%` window has already completed cleanly.',
  '',
  '## Promotion Rule',
  '',
  results.every((item) => item.ok)
    ? '- Promotion readiness: `ready`'
    : '- Promotion readiness: `blocked`',
  '',
  '## Command Output Summary',
  ''
)

for (const result of results) {
  reportLines.push(`### ${result.label}`, '')
  if (result.output) {
    reportLines.push('```text', result.output, '```', '')
  } else {
    reportLines.push('_no output_', '')
  }
}

mkdirSync(path.join(cwd, 'docs', 'reports'), { recursive: true })
const reportPath = path.join(cwd, 'docs', 'reports', `finance-receipts-promotion-readiness-${timestamp}.md`)
writeFileSync(reportPath, `${reportLines.join('\n')}\n`, 'utf8')

console.log(
  JSON.stringify(
    {
      ok: results.every((item) => item.ok),
      reportPath,
      checks: results.map(({ label, ok, skipped }) => ({ label, ok, skipped })),
    },
    null,
    2
  )
)

if (!results.every((item) => item.ok)) {
  process.exit(1)
}
