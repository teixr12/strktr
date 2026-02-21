'use client'

import { useEffect, useState } from 'react'
import { getUserRole, canAccess } from '@/lib/auth/roles'
import type { UserRole } from '@/types/database'

interface RoleGateProps {
  requiredRole: UserRole
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function RoleGate({ requiredRole, children, fallback }: RoleGateProps) {
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    getUserRole().then((role) => {
      setAllowed(canAccess(role, requiredRole))
    })
  }, [requiredRole])

  if (allowed === null) return null // Loading
  if (!allowed) return fallback ? <>{fallback}</> : null

  return <>{children}</>
}
