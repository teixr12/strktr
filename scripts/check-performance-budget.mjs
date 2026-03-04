#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const budgetPath = path.join(root, '.governance', 'performance-budget.json')

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, acc)
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(full)
  }
  return acc
}

function countMatches(content, regex) {
  let count = 0
  while (regex.exec(content) !== null) {
    count += 1
  }
  return count
}

const budget = JSON.parse(readFileSync(budgetPath, 'utf8'))
const violations = []

for (const rule of budget.rules || []) {
  const includeDirs = (rule.include || []).map((dir) => path.join(root, dir))
  const files = includeDirs.flatMap((dir) => (statSync(dir).isDirectory() ? walk(dir) : []))
  const pattern = new RegExp(rule.pattern, 'g')

  let total = 0
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    total += countMatches(source, pattern)
  }

  if (total > rule.max) {
    violations.push(
      `[${rule.id}] count ${total} exceeds budget ${rule.max} (pattern: ${rule.pattern})`
    )
  } else {
    console.log(`[${rule.id}] count ${total}/${rule.max}`)
  }
}

if (violations.length > 0) {
  console.error('Performance budget check failed:')
  for (const violation of violations) console.error(`- ${violation}`)
  process.exit(1)
}

console.log('Performance budget check passed.')
