#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const apiRoot = join(root, 'src', 'app', 'api', 'v1')
const responseFile = join(root, 'src', 'lib', 'api', 'response.ts')

function walk(dir, acc = []) {
  const entries = readdirSync(dir)
  for (const entry of entries) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, acc)
    else if (entry === 'route.ts') acc.push(full)
  }
  return acc
}

const violations = []

const responseContent = readFileSync(responseFile, 'utf8')
if (!responseContent.includes('contractVersion')) {
  violations.push('[response.ts] missing meta.contractVersion in success envelope')
}

const routes = walk(apiRoot)
for (const route of routes) {
  const rel = route.replace(root + '/', '')
  const content = readFileSync(route, 'utf8')

  if (content.includes('NextResponse.json(')) {
    violations.push(`[${rel}] uses NextResponse.json directly (must use ok/fail helpers)`)
  }

  const importsResponse =
    content.includes("from '@/lib/api/response'") ||
    content.includes('from "@/lib/api/response"')

  if (!importsResponse) {
    violations.push(`[${rel}] missing import from @/lib/api/response`)
  }

  const usesOkOrFail = content.includes('ok(') || content.includes('fail(')
  if (!usesOkOrFail) {
    violations.push(`[${rel}] missing ok()/fail() usage`)
  }
}

if (violations.length > 0) {
  console.error('API contract validation failed:')
  for (const v of violations) console.error(`- ${v}`)
  process.exit(1)
}

console.log(`API contract validation passed for ${routes.length} route files.`)
