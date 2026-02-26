#!/usr/bin/env node

import { execSync } from 'node:child_process'

function getEnv(name, fallback = '') {
  return process.env[name] || fallback
}

const headRef = getEnv('GITHUB_HEAD_REF')
const baseSha = getEnv('GITHUB_BASE_SHA')
const headSha = getEnv('GITHUB_SHA')

const violations = []

if (headRef && !/^codex\//.test(headRef) && !/^hotfix\//.test(headRef)) {
  violations.push(`Branch must start with codex/ or hotfix/. Current: ${headRef}`)
}

let changedFiles = []
try {
  if (baseSha && headSha) {
    const output = execSync(`git diff --name-only ${baseSha} ${headSha}`, { encoding: 'utf8' })
    changedFiles = output.split('\n').map((x) => x.trim()).filter(Boolean)
  }
} catch (err) {
  violations.push(`Unable to compute changed files: ${err instanceof Error ? err.message : 'unknown error'}`)
}

const touchesCritical = changedFiles.some((file) =>
  file.startsWith('src/app/api/v1/') ||
  file.startsWith('src/lib/auth/') ||
  file.startsWith('supabase/migrations/')
)

const updatedAdr = changedFiles.some((file) => file.startsWith('docs/adr/'))
if (touchesCritical && !updatedAdr) {
  violations.push('Critical API/auth/migration changes require ADR update in docs/adr/')
}

if (violations.length > 0) {
  console.error('PR governance check failed:')
  for (const v of violations) console.error(`- ${v}`)
  process.exit(1)
}

console.log('PR governance check passed.')
