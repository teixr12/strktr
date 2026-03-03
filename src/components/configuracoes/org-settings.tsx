'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { apiRequest } from '@/lib/api/client'
import { featureFlags } from '@/lib/feature-flags'
import { toast } from '@/hooks/use-toast'
import { useConfirm } from '@/hooks/use-confirm'
import { getRoleLabel, getRoleBadgeColor, canAccess } from '@/lib/auth/roles'
import { Building2, UserPlus, Shield, Crown, Users, Trash2, Mail } from 'lucide-react'
import { PageHeader, QuickActionBar, SectionCard } from '@/components/ui/enterprise'
import { ModalSheet } from '@/components/ui/modal-sheet'
import { FormField, FormInput, FormSelect } from '@/components/ui/form-field'
import type { UserRole, OrgMembro, Organizacao } from '@/types/database'

interface Props {
  userId: string
  orgMembro: OrgMembro | null
  orgMembros: OrgMembro[]
  organizacao: Organizacao | null
}

const inviteFormSchema = z.object({
  email: z.string().email('Email inválido').min(1, 'Email é obrigatório'),
  role: z.enum(['admin', 'manager', 'user']).default('user'),
})
type InviteFormValues = z.infer<typeof inviteFormSchema>

const orgFormSchema = z.object({
  nome: z.string().trim().min(2, 'Nome da organização é obrigatório'),
  cnpj: z.string().trim().optional(),
})
type OrgFormValues = z.infer<typeof orgFormSchema>

export function OrgSettingsContent({ userId, orgMembro, orgMembros: initialMembros, organizacao: initialOrg }: Props) {
  const { confirm, dialog: confirmDialog } = useConfirm()
  const useV2 = featureFlags.uiTailadminV1 && featureFlags.uiV2Configuracoes
  const [org, setOrg] = useState(initialOrg)
  const [membros, setMembros] = useState(initialMembros)
  const [showCreateOrg, setShowCreateOrg] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  const { register: registerOrg, handleSubmit: handleOrgSubmit, formState: { errors: orgErrors } } = useForm<OrgFormValues>({
    resolver: zodResolver(orgFormSchema) as never,
    defaultValues: { nome: '', cnpj: '' },
  })

  const { register: registerInvite, handleSubmit: handleInviteSubmit, reset: resetInvite, formState: { errors: inviteErrors } } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema) as never,
    defaultValues: { email: '', role: 'user' },
  })

  const userRole = orgMembro?.role || 'admin'
  const isAdmin = userRole === 'admin'
  const isManagerOrAbove = canAccess(userRole, 'manager')

  async function onOrgSubmit(values: OrgFormValues) {
    setIsBusy(true)
    setLastError(null)
    try {
      const created = await apiRequest<{ organizacao: Organizacao; membership: OrgMembro }>(
        '/api/v1/config/org',
        { method: 'POST', body: { nome: values.nome.trim(), cnpj: values.cnpj || null } }
      )
      setOrg(created.organizacao)
      setMembros([created.membership])
      setShowCreateOrg(false)
      toast('Organização criada!', 'success')
      window.location.reload()
    } catch (err) {
      const message = err instanceof Error ? `${err.message}. Tentar novamente.` : 'Erro ao criar organização. Tentar novamente.'
      setLastError(message)
      toast(message, 'error')
    } finally {
      setIsBusy(false)
    }
  }

  async function onInviteSubmit(values: InviteFormValues) {
    if (!org) return
    setIsBusy(true)
    setLastError(null)
    try {
      const member = await apiRequest<OrgMembro>('/api/v1/config/org-members', {
        method: 'POST',
        body: { email: values.email.trim(), role: values.role },
      })
      setMembros((prev) => {
        const withoutDuplicated = prev.filter((item) => item.id !== member.id)
        return [...withoutDuplicated, member]
      })
      toast('Membro adicionado!', 'success')
      setShowInvite(false)
      resetInvite()
    } catch (err) {
      const message = err instanceof Error ? `${err.message}. Tentar novamente.` : 'Erro ao adicionar membro. Tentar novamente.'
      setLastError(message)
      toast(message, 'error')
    } finally {
      setIsBusy(false)
    }
  }

  async function updateMemberRole(membroId: string, newRole: UserRole) {
    setIsBusy(true)
    setLastError(null)
    try {
      const updated = await apiRequest<OrgMembro>(`/api/v1/config/org-members/${membroId}/role`, {
        method: 'PATCH',
        body: { role: newRole },
      })
      setMembros((prev) => prev.map((m) => m.id === membroId ? updated : m))
      toast('Role atualizado!', 'success')
    } catch (err) {
      const message = err instanceof Error ? `${err.message}. Tentar novamente.` : 'Erro ao atualizar papel. Tentar novamente.'
      setLastError(message)
      toast(message, 'error')
    } finally {
      setIsBusy(false)
    }
  }

  async function removeMember(membroId: string, membroUserId: string) {
    if (membroUserId === userId) { toast('Você não pode se remover da organização', 'error'); return }
    const ok = await confirm({ title: 'Remover membro?', description: 'O membro será removido da organização.', confirmLabel: 'Remover', variant: 'danger' })
    if (!ok) return
    setIsBusy(true)
    setLastError(null)
    try {
      await apiRequest<{ success: boolean }>(`/api/v1/config/org-members/${membroId}`, { method: 'DELETE' })
      setMembros((prev) => prev.filter((m) => m.id !== membroId))
      toast('Membro removido', 'info')
    } catch (err) {
      const message = err instanceof Error ? `${err.message}. Tentar novamente.` : 'Erro ao remover membro. Tentar novamente.'
      setLastError(message)
      toast(message, 'error')
    } finally {
      setIsBusy(false)
    }
  }

  async function updateOrgName(nome: string) {
    if (!org || !nome.trim()) return
    setIsBusy(true)
    setLastError(null)
    try {
      const updated = await apiRequest<Organizacao>('/api/v1/config/org', {
        method: 'PATCH',
        body: { nome: nome.trim() },
      })
      setOrg(updated)
      toast('Nome atualizado!', 'success')
    } catch (err) {
      const message = err instanceof Error ? `${err.message}. Tentar novamente.` : 'Erro ao atualizar organização. Tentar novamente.'
      setLastError(message)
      toast(message, 'error')
    } finally {
      setIsBusy(false)
    }
  }

  // No organization — show create or solo mode
  if (!org) {
    return (
      <div aria-busy={isBusy} className={`${useV2 ? 'tailadmin-page' : 'p-4 md:p-6'} space-y-6`}>
        <PageHeader title="Configurações" subtitle="Gerencie sua organização e equipe" />

        {lastError && (
          <SectionCard className="mx-auto max-w-lg p-4 border border-red-200/70 dark:border-red-800/70">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-red-700 dark:text-red-300">{lastError}</p>
              <button
                onClick={() => window.location.reload()}
                className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
              >
                Tentar novamente
              </button>
            </div>
          </SectionCard>
        )}

        <SectionCard className="mx-auto max-w-lg p-8 text-center">
          <Building2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Modo Individual
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            Você está usando o STRKTR no modo individual. Crie uma organização para convidar
            membros da equipe e compartilhar dados.
          </p>

          {!showCreateOrg ? (
            <button
              onClick={() => setShowCreateOrg(true)}
              className="px-6 py-3 bg-sand-500 hover:bg-sand-600 text-white font-medium rounded-2xl btn-press transition-all"
            >
              Criar Organização
            </button>
          ) : (
            <form onSubmit={handleOrgSubmit(onOrgSubmit)} className="space-y-3 text-left">
              <FormField label="Nome da empresa" error={orgErrors.nome} required>
                <FormInput registration={registerOrg('nome')} hasError={!!orgErrors.nome} placeholder="Nome da empresa" />
              </FormField>
              <FormField label="CNPJ">
                <FormInput registration={registerOrg('cnpj')} placeholder="CNPJ (opcional)" />
              </FormField>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowCreateOrg(false)} className="flex-1 py-3 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 py-3 bg-sand-500 hover:bg-sand-600 text-white font-medium rounded-2xl btn-press transition-all">
                  Criar
                </button>
              </div>
            </form>
          )}
        </SectionCard>
      </div>
    )
  }

  // Has organization — show settings
  return (
    <div aria-busy={isBusy} className={`${useV2 ? 'tailadmin-page' : 'p-4 md:p-6'} space-y-6`}>
      <PageHeader
        title="Configurações"
        subtitle="Gerencie sua organização e equipe"
        actions={
          isAdmin ? (
            <QuickActionBar
              actions={[{
                label: 'Convidar membro',
                icon: <UserPlus className="h-4 w-4" />,
                onClick: () => setShowInvite(true),
                tone: 'info',
              }]}
            />
          ) : undefined
        }
      />

      {lastError && (
        <SectionCard className="p-4 border border-red-200/70 dark:border-red-800/70">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-red-700 dark:text-red-300">{lastError}</p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        </SectionCard>
      )}

      {/* Org Info */}
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-sand-100 dark:bg-sand-900/30 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-sand-600 dark:text-sand-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{org.nome}</h3>
            <div className="flex items-center gap-2">
              {org.cnpj && <span className="text-xs text-gray-500">{org.cnpj}</span>}
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-sand-100 text-sand-700 dark:bg-sand-900/30 dark:text-sand-400 uppercase">
                {org.plano}
              </span>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="flex gap-2">
            <input
              defaultValue={org.nome}
              onBlur={(e) => updateOrgName(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white"
            />
          </div>
        )}
      </div>

      {/* Your Role */}
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Seu papel</p>
            <span className={`inline-block mt-1 px-2.5 py-0.5 text-xs font-bold rounded-full ${getRoleBadgeColor(userRole)}`}>
              {getRoleLabel(userRole)}
            </span>
          </div>
        </div>
      </div>

      {/* Members */}
      {isManagerOrAbove && (
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-gray-400" />
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Membros ({membros.length})
              </h3>
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowInvite(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-sand-500 hover:bg-sand-600 text-white text-xs font-medium rounded-xl btn-press transition-all"
              >
                <UserPlus className="w-3.5 h-3.5" /> Convidar
              </button>
            )}
          </div>

          <div className="space-y-2">
            {membros.map((m) => {
              const profile = m.profiles as { nome: string; email: string | null } | null
              return (
                <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                      {(profile?.nome || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {profile?.nome || 'Usuário'}
                        {m.user_id === userId && <span className="text-xs text-gray-400 ml-1">(você)</span>}
                      </p>
                      <p className="text-xs text-gray-500">{profile?.email || ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && m.user_id !== userId ? (
                      <>
                        <select
                          value={m.role}
                          onChange={(e) => updateMemberRole(m.id, e.target.value as UserRole)}
                          className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 dark:text-white"
                        >
                          <option value="admin">Administrador</option>
                          <option value="manager">Gerente</option>
                          <option value="user">Usuário</option>
                        </select>
                        <button
                          onClick={() => removeMember(m.id, m.user_id)}
                          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${getRoleBadgeColor(m.role)}`}>
                        {getRoleLabel(m.role)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Permissions Info */}
      <div className="glass-card rounded-2xl p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-500" /> Permissões por Papel
        </h3>
        <div className="space-y-2 text-xs">
          <div className="flex items-start gap-3 p-2.5 bg-purple-50 dark:bg-purple-900/10 rounded-lg">
            <span className="font-bold text-purple-700 dark:text-purple-400 w-24 shrink-0">Administrador</span>
            <span className="text-gray-600 dark:text-gray-400">Acesso total: gerenciar organização, convidar/remover membros, alterar roles, todas as funcionalidades</span>
          </div>
          <div className="flex items-start gap-3 p-2.5 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
            <span className="font-bold text-blue-700 dark:text-blue-400 w-24 shrink-0">Gerente</span>
            <span className="text-gray-600 dark:text-gray-400">Visualizar membros, gerenciar obras/projetos/compras/financeiro, criar e editar dados</span>
          </div>
          <div className="flex items-start gap-3 p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <span className="font-bold text-gray-600 dark:text-gray-400 w-24 shrink-0">Usuário</span>
            <span className="text-gray-600 dark:text-gray-400">Visualizar dados compartilhados, adicionar notas e registros, sem acesso a configurações</span>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      <ModalSheet open={showInvite} onClose={() => { setShowInvite(false); resetInvite() }} title="Convidar Membro">
        <form onSubmit={handleInviteSubmit(onInviteSubmit)} className="space-y-3">
          <FormField label="Email do usuário" error={inviteErrors.email}>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
              <input
                {...registerInvite('email')}
                placeholder="email@exemplo.com"
                type="email"
                className={`w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border rounded-xl text-sm focus:outline-none focus:ring-2 dark:text-white transition-colors ${
                  inviteErrors.email
                    ? 'border-red-300 focus:ring-red-400/50 dark:border-red-700'
                    : 'border-gray-200 focus:ring-sand-400 dark:border-gray-700'
                }`}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">O usuário precisa ter uma conta no STRKTR</p>
          </FormField>
          <FormField label="Papel">
            <FormSelect registration={registerInvite('role')}>
              <option value="user">Usuário</option>
              <option value="manager">Gerente</option>
              <option value="admin">Administrador</option>
            </FormSelect>
          </FormField>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => { setShowInvite(false); resetInvite() }} className="flex-1 py-3 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all">
              Cancelar
            </button>
            <button type="submit" className="flex-1 py-3 bg-sand-500 hover:bg-sand-600 text-white font-medium rounded-2xl btn-press transition-all">
              Convidar
            </button>
          </div>
        </form>
      </ModalSheet>

      {confirmDialog}
    </div>
  )
}
