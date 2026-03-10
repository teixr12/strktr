#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const cwd = process.cwd()
const reportsDir = path.join(cwd, 'docs', 'reports')
fs.mkdirSync(reportsDir, { recursive: true })

function run(command, args = []) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30_000,
  }).trim()
}

function fetchProgramJson() {
  const snapshotPath = process.env.ARCH_EXECUTION_PROGRAM_JSON
  if (snapshotPath) {
    return fs.readFileSync(snapshotPath, 'utf8').trim()
  }

  return run('bash', [
    '-lc',
    "curl -sS --connect-timeout 5 -m 25 'https://strktr.vercel.app/api/v1/ops/program'",
  ])
}

function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function asList(items) {
  return Array.isArray(items) ? items : []
}

const raw = fetchProgramJson()
const payload = parseJson(raw)

if (!payload?.data?.executionControl) {
  console.error('Missing executionControl in /api/v1/ops/program payload')
  process.exit(1)
}

const executionControl = payload.data.executionControl
const currentPhase = executionControl.currentPhase ?? 'unknown'
const allowedNow = asList(executionControl.allowedNow)
const blockedNow = asList(executionControl.blockedNow)
const structuralGaps = asList(executionControl.structuralGaps)
const violations = asList(executionControl.violations)
const certification = executionControl.certification ?? {}

const expectedPhase = process.env.ARCH_EXECUTION_EXPECT_PHASE || ''
const expectedAllowedClassifications = (process.env.ARCH_EXECUTION_ALLOWED_CLASSIFICATIONS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

const phaseMismatch = expectedPhase.length > 0 && currentPhase !== expectedPhase
const disallowedAllowedTasks =
  expectedAllowedClassifications.length === 0
    ? []
    : allowedNow.filter(
        (task) => !expectedAllowedClassifications.includes(String(task.classification || ''))
      )

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const reportPath = path.join(reportsDir, `architecture-execution-control-${stamp}.md`)

const lines = [
  '# Architecture Execution Control',
  '',
  `- GeneratedAt: ${new Date().toISOString()}`,
  `- CurrentPhase: ${currentPhase}`,
  `- GoverningRule: ${executionControl.governingRule ?? 'unknown'}`,
  '',
  '## Certification',
  `- LiveCoreModulesReady: ${String(certification.liveCoreModulesReady ?? false)}`,
  `- ReleaseTraceabilityVerified: ${String(certification.releaseTraceabilityVerified ?? false)}`,
  `- AuthStrictE2EStable: ${String(certification.authStrictE2EStable ?? false)}`,
  `- RollbackDrillsDocumented: ${String(certification.rollbackDrillsDocumented ?? false)}`,
  `- CloseoutPublished: ${String(certification.closeoutPublished ?? false)}`,
  '',
  '## Allowed Now',
]

if (allowedNow.length === 0) {
  lines.push('- [none]')
} else {
  for (const task of allowedNow) {
    lines.push(`- ${task.title} (${task.classification})`)
  }
}

lines.push('', '## Blocked Now')

if (blockedNow.length === 0) {
  lines.push('- [none]')
} else {
  for (const task of blockedNow) {
    const reasons = asList(task.blockingReasons)
    lines.push(`- ${task.title} (${task.classification})`)
    if (reasons.length > 0) {
      for (const reason of reasons) {
        lines.push(`  - ${reason}`)
      }
    }
  }
}

lines.push('', '## Structural Gaps')

if (structuralGaps.length === 0) {
  lines.push('- [none]')
} else {
  for (const gap of structuralGaps) {
    lines.push(`- ${gap.title}: ${gap.status}`)
  }
}

lines.push('', '## Violations')

if (violations.length === 0) {
  lines.push('- [none]')
} else {
  for (const violation of violations) {
    lines.push(`- ${violation}`)
  }
}

if (phaseMismatch) {
  lines.push('', '## Failure', `- ExpectedPhase: ${expectedPhase}`, `- ActualPhase: ${currentPhase}`)
}

if (disallowedAllowedTasks.length > 0) {
  lines.push('', '## Unexpected Allowed Tasks')
  for (const task of disallowedAllowedTasks) {
    lines.push(`- ${task.title} (${task.classification})`)
  }
}

fs.writeFileSync(reportPath, `${lines.join('\n')}\n`)
console.log(reportPath)

if (violations.length > 0 || phaseMismatch || disallowedAllowedTasks.length > 0) {
  process.exit(1)
}
