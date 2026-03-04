#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const srcRoot = path.join(root, 'src')
const analyticsTypesPath = path.join(root, 'src', 'shared', 'types', 'analytics.ts')

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, acc)
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(full)
  }
  return acc
}

function getRegistry() {
  const content = readFileSync(analyticsTypesPath, 'utf8')
  const match = content.match(/ANALYTICS_EVENT_TYPES\s*=\s*\[(.*?)\]\s*as const/s)
  if (!match) {
    throw new Error('Unable to parse ANALYTICS_EVENT_TYPES registry')
  }
  return new Set(Array.from(match[1].matchAll(/'([^']+)'/g)).map((entry) => entry[1]))
}

function relative(file) {
  return file.replace(`${root}/`, '')
}

function lineNumberForIndex(content, index) {
  return content.slice(0, index).split('\n').length
}

const registry = getRegistry()
const files = walk(srcRoot).filter((file) => file !== analyticsTypesPath)
const violations = []
let checkedEvents = 0

for (const file of files) {
  const content = readFileSync(file, 'utf8')
  if (!content.includes('eventType') && !content.includes('track(')) continue

  const rel = relative(file)
  const patterns = [
    /\beventType\s*:\s*['"]([^'"]+)['"]/g,
    /\btrack\(\s*['"]([^'"]+)['"]/g,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(content)) !== null) {
      const eventName = match[1]
      checkedEvents += 1
      if (!registry.has(eventName)) {
        const line = lineNumberForIndex(content, match.index)
        violations.push(`[${rel}:${line}] Unregistered analytics event: "${eventName}"`)
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Analytics taxonomy check failed:')
  for (const violation of violations) console.error(`- ${violation}`)
  process.exit(1)
}

console.log(
  `Analytics taxonomy check passed. Registry size=${registry.size}, references checked=${checkedEvents}.`
)
