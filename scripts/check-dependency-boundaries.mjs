#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const srcRoot = path.join(root, 'src')

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, acc)
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(full)
  }
  return acc
}

function relative(file) {
  return file.replace(`${root}/`, '')
}

function lineNumberForIndex(content, index) {
  return content.slice(0, index).split('\n').length
}

function collectImports(source) {
  const imports = []
  const regexes = [
    /\bimport[\s\S]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bexport[\s\S]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]

  for (const regex of regexes) {
    let match
    while ((match = regex.exec(source)) !== null) {
      imports.push({
        target: match[1],
        index: match.index,
      })
    }
  }

  return imports
}

const files = walk(srcRoot)
const violations = []

for (const file of files) {
  const rel = relative(file)
  const content = readFileSync(file, 'utf8')
  const imports = collectImports(content)

  const inShared = rel.startsWith('src/shared/')
  const inComponents = rel.startsWith('src/components/')
  const inPlatform = rel.startsWith('src/platform/')

  for (const entry of imports) {
    const target = entry.target
    const line = lineNumberForIndex(content, entry.index)

    if (
      inShared &&
      (target.startsWith('@/app/') ||
        target.startsWith('@/components/') ||
        target.startsWith('@/domains/') ||
        target.startsWith('@/server/') ||
        target.startsWith('@/platform/') ||
        target.startsWith('@/lib/'))
    ) {
      violations.push(
        `[${rel}:${line}] src/shared/* cannot import runtime layers (${target})`
      )
    }

    if (
      inComponents &&
      (target.startsWith('@/server/') ||
        target === '@/lib/supabase/service' ||
        target.startsWith('@/lib/supabase/server'))
    ) {
      violations.push(
        `[${rel}:${line}] src/components/* cannot import server/service-only modules (${target})`
      )
    }

    if (inPlatform && target.startsWith('@/app/')) {
      violations.push(`[${rel}:${line}] src/platform/* cannot import app routes (${target})`)
    }
  }
}

if (violations.length > 0) {
  console.error('Dependency boundary check failed:')
  for (const violation of violations) console.error(`- ${violation}`)
  process.exit(1)
}

console.log(`Dependency boundary check passed for ${files.length} files.`)
