#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const resultDir = path.resolve(process.cwd(), 'test-results')
mkdirSync(resultDir, { recursive: true })

const run = spawnSync('npx', ['playwright', 'test', '--reporter=json'], {
  encoding: 'utf8',
  stdio: ['inherit', 'pipe', 'inherit'],
  env: process.env,
  maxBuffer: 25 * 1024 * 1024,
})

const rawJson = (run.stdout || '').trim()
const reportPath = path.join(resultDir, 'playwright-report.json')
writeFileSync(reportPath, rawJson || '{}\n', 'utf8')

if (!rawJson) {
  console.error('No Playwright JSON output captured.')
  console.log('E2E strict mode failed: no Playwright JSON output captured.')
  process.exit(run.status || 1)
}

let report
try {
  report = JSON.parse(rawJson)
} catch (error) {
  console.error('Failed to parse Playwright JSON output.')
  console.error(error instanceof Error ? error.message : String(error))
  console.log('E2E strict mode failed: invalid Playwright JSON output.')
  process.exit(run.status || 1)
}

const skipped = Number(report?.stats?.skipped || 0)
const unexpected = Number(report?.stats?.unexpected || 0)
const failures = Number(report?.stats?.failed || 0)

if (run.status && run.status !== 0) {
  process.exit(run.status)
}

if (skipped > 0) {
  console.error(`E2E strict mode failed: ${skipped} skipped test(s).`)
  console.log(`E2E strict mode failed: ${skipped} skipped test(s).`)
  process.exit(1)
}

if (unexpected > 0 || failures > 0) {
  console.error(`E2E strict mode failed: unexpected=${unexpected}, failed=${failures}.`)
  console.log(`E2E strict mode failed: unexpected=${unexpected}, failed=${failures}.`)
  process.exit(1)
}

console.log(`E2E strict mode passed. skipped=${skipped}, failed=${failures}, unexpected=${unexpected}.`)
