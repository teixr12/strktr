import { createClient } from '@/lib/supabase/client'
import type { UserRole, OrgMembro } from '@/types/database'

const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 3,
  manager: 2,
  user: 1,
}

export async function getUserOrgMembership(): Promise<OrgMembro | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('org_membros')
    .select('*, organizacoes(nome, plano)')
    .eq('user_id', user.id)
    .eq('status', 'ativo')
    .single()

  return data || null
}

export async function getUserRole(): Promise<UserRole> {
  const membership = await getUserOrgMembership()
  return membership?.role || 'admin' // Solo users are admin of their own data
}

export function canAccess(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    admin: 'Administrador',
    manager: 'Gerente',
    user: 'Usuário',
  }
  return labels[role]
}

export function getRoleBadgeColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    manager: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    user: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  }
  return colors[role]
}
