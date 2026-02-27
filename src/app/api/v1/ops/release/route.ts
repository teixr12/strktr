import { ok } from '@/lib/api/response'
import { featureFlags } from '@/lib/feature-flags'

export async function GET(request: Request) {
  const deploymentUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : null

  return ok(
    request,
    {
      app: 'strktr',
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'local',
      version: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
      branch: process.env.VERCEL_GIT_COMMIT_REF || null,
      deploymentUrl,
      generatedAt: new Date().toISOString(),
      flags: featureFlags,
    },
    { flag: 'opsReleaseMarker' }
  )
}
