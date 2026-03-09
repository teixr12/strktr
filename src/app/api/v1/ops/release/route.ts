import { ok } from '@/lib/api/response'
import { featureFlags } from '@/lib/feature-flags'
import { getReleaseMetadata } from '@/server/ops/release-metadata'

export async function GET(request: Request) {
  const release = await getReleaseMetadata()

  return ok(
    request,
    {
      app: 'strktr',
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'local',
      version: release.version,
      branch: release.branch,
      deploymentUrl: release.deploymentUrl,
      releaseSource: release.source,
      generatedAt: new Date().toISOString(),
      flags: featureFlags,
    },
    { flag: 'opsReleaseMarker' }
  )
}
