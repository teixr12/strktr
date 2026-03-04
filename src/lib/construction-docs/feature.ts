function normalizeEnv(value: string | undefined | null): string {
  return (value || '').trim().toLowerCase()
}

export function isConstructionDocsEnabled(): boolean {
  return (
    normalizeEnv(process.env.FEATURE_CONSTRUCTION_DOCS) === 'true' ||
    normalizeEnv(process.env.NEXT_PUBLIC_FF_CONSTRUCTION_DOCS_V1) === 'true'
  )
}
