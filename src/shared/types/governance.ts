export type ApiContractVersion = 'v1'

export type FeatureOwnership = {
  feature: string
  domain: 'obras' | 'comercial' | 'financeiro' | 'projetos' | 'config' | 'portal' | 'plataforma'
  owner: string
  flagKey?: string
}

export type ReleaseGateResult = {
  lint: boolean
  build: boolean
  apiContracts: boolean
  e2eSmoke: boolean
  securityScan: boolean
  notes?: string[]
}

export type PermissionMatrix = {
  role: 'admin' | 'manager' | 'user'
  permissions: string[]
}
