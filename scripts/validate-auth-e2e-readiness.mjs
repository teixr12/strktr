#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const STRICT_ENV_KEYS = [
  'E2E_BEARER_TOKEN',
  'E2E_OBRA_ID',
  'E2E_MANAGER_BEARER_TOKEN',
  'E2E_USER_BEARER_TOKEN',
  'E2E_FOREIGN_OBRA_ID',
]

const PREPARE_SOURCE_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'E2E_USER_EMAIL',
  'E2E_USER_PASSWORD',
  'E2E_MANAGER_EMAIL',
  'E2E_MANAGER_PASSWORD',
  'E2E_ROLE_USER_EMAIL',
  'E2E_ROLE_USER_PASSWORD',
  'E2E_FOREIGN_EMAIL',
  'E2E_FOREIGN_PASSWORD',
]

const now = new Date()
const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(
  now.getUTCDate()
).padStart(2, '0')}-${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(
  2,
  '0'
)}${String(now.getUTCSeconds()).padStart(2, '0')}`

const reportsDir = join(process.cwd(), 'docs', 'reports')
mkdirSync(reportsDir, { recursive: true })
const reportPath = join(reportsDir, `auth-e2e-readiness-${stamp}.md`)

function present(key) {
  return Boolean(String(process.env[key] || '').trim())
}

function writeReport(lines) {
  writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8')
}

const missingStrict = STRICT_ENV_KEYS.filter((key) => !present(key))
const missingPrepare = PREPARE_SOURCE_KEYS.filter((key) => !present(key))
const strictReady = missingStrict.length === 0
const canAutoPrepare = missingStrict.length > 0 && missingPrepare.length === 0

const lines = [
  '# Auth E2E Readiness',
  '',
  `- GeneratedAt: ${new Date().toISOString()}`,
  `- StrictReady: ${strictReady}`,
  `- CanAutoPrepare: ${canAutoPrepare}`,
  `- MissingStrictCount: ${missingStrict.length}`,
  `- MissingPrepareSourceCount: ${missingPrepare.length}`,
  '',
  '## Missing Strict Env',
  '',
  ...(
    missingStrict.length > 0
      ? missingStrict.map((key) => `- ${key}`)
      : ['- none']
  ),
  '',
  '## Missing Prepare Source Env',
  '',
  ...(
    missingPrepare.length > 0
      ? missingPrepare.map((key) => `- ${key}`)
      : ['- none']
  ),
  '',
  '## Recommended Path',
]

if (strictReady) {
  lines.push('- Status: pass')
  lines.push('- Run `npm run test:e2e:strict:auth`')
} else if (canAutoPrepare) {
  lines.push('- Status: warn')
  lines.push('- Run `E2E_AUTO_PREPARE=1 npm run test:e2e:strict:auth`')
} else {
  lines.push('- Status: fail')
  lines.push('- Populate missing envs or provide the prepare-source credentials first.')
}

writeReport(lines)

console.log(`Auth E2E readiness written to ${reportPath}`)
if (!strictReady && !canAutoPrepare) {
  process.exit(1)
}
