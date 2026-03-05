import { isDocsWorkspaceEnabledForOrg } from '@/server/feature-flags/wave2-canary'

function normalizeEnv(value: string | undefined | null): string {
  return (value || '').trim().toLowerCase()
}

export function isDocsWorkspaceEnabled(): boolean {
  return normalizeEnv(process.env.NEXT_PUBLIC_FF_DOCS_WORKSPACE_V1) === 'true'
}

export function isDocsWorkspaceEnabledForCurrentOrg(orgId: string | null | undefined): boolean {
  return isDocsWorkspaceEnabledForOrg(orgId)
}
