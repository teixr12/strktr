#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

function normalize(value) {
  const next = String(value || '').trim()
  return next.length > 0 ? next : null
}

function runGit(args) {
  try {
    return normalize(execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))
  } catch {
    return null
  }
}

const cwd = process.cwd()
const outputDir = path.join(cwd, '.generated')
const outputPath = path.join(outputDir, 'release-meta.json')

const envVersion =
  normalize(process.env.VERCEL_GIT_COMMIT_SHA) ||
  normalize(process.env.GIT_COMMIT_SHA) ||
  normalize(process.env.SOURCE_VERSION)
const envBranch =
  normalize(process.env.VERCEL_GIT_COMMIT_REF) ||
  normalize(process.env.GIT_BRANCH) ||
  normalize(process.env.BRANCH_NAME)
const envDeploymentUrl = normalize(process.env.VERCEL_URL)
  ? `https://${normalize(process.env.VERCEL_URL)}`
  : normalize(process.env.VERCEL_BRANCH_URL)
    ? `https://${normalize(process.env.VERCEL_BRANCH_URL)}`
    : normalize(process.env.VERCEL_PROJECT_PRODUCTION_URL)
      ? `https://${normalize(process.env.VERCEL_PROJECT_PRODUCTION_URL)}`
      : null

const gitVersion = runGit(['rev-parse', 'HEAD'])
const gitBranch = runGit(['branch', '--show-current']) || runGit(['rev-parse', '--abbrev-ref', 'HEAD'])

const payload = {
  version: envVersion || gitVersion,
  branch: envBranch || (gitBranch === 'HEAD' ? null : gitBranch),
  deploymentUrl: envDeploymentUrl,
  source: envVersion ? 'runtime_env' : gitVersion ? 'git_fallback' : 'unknown',
  generatedAt: new Date().toISOString(),
}

mkdirSync(outputDir, { recursive: true })
writeFileSync(outputPath, JSON.stringify(payload, null, 2) + '\n', 'utf8')

console.log(`Release metadata generated: ${path.relative(cwd, outputPath)}`)
