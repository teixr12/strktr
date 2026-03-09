import { readFile } from 'node:fs/promises'
import path from 'node:path'

type ReleaseMetadata = {
  version: string
  branch: string | null
  deploymentUrl: string | null
  source: 'runtime_env' | 'build_artifact' | 'unknown'
}

function normalize(value: string | undefined | null): string | null {
  const next = String(value || '').trim()
  return next.length > 0 ? next : null
}

let cachedPromise: Promise<ReleaseMetadata> | null = null

async function loadGeneratedMetadata() {
  try {
    const filePath = path.join(process.cwd(), '.generated', 'release-meta.json')
    const raw = await readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw) as {
      version?: string | null
      branch?: string | null
      deploymentUrl?: string | null
    }

    return {
      version: normalize(parsed.version) || 'unknown',
      branch: normalize(parsed.branch),
      deploymentUrl: normalize(parsed.deploymentUrl),
      source: 'build_artifact' as const,
    }
  } catch {
    return {
      version: 'unknown',
      branch: null,
      deploymentUrl: null,
      source: 'unknown' as const,
    }
  }
}

export async function getReleaseMetadata(): Promise<ReleaseMetadata> {
  const runtimeVersion =
    normalize(process.env.VERCEL_GIT_COMMIT_SHA) ||
    normalize(process.env.GIT_COMMIT_SHA) ||
    normalize(process.env.SOURCE_VERSION)
  const runtimeBranch =
    normalize(process.env.VERCEL_GIT_COMMIT_REF) ||
    normalize(process.env.GIT_BRANCH) ||
    normalize(process.env.BRANCH_NAME)
  const runtimeDeploymentUrl = normalize(process.env.VERCEL_URL)
    ? `https://${normalize(process.env.VERCEL_URL)}`
    : normalize(process.env.VERCEL_BRANCH_URL)
      ? `https://${normalize(process.env.VERCEL_BRANCH_URL)}`
      : normalize(process.env.VERCEL_PROJECT_PRODUCTION_URL)
        ? `https://${normalize(process.env.VERCEL_PROJECT_PRODUCTION_URL)}`
        : null

  if (runtimeVersion) {
    return {
      version: runtimeVersion,
      branch: runtimeBranch,
      deploymentUrl: runtimeDeploymentUrl,
      source: 'runtime_env',
    }
  }

  if (!cachedPromise) {
    cachedPromise = loadGeneratedMetadata()
  }

  return cachedPromise
}
