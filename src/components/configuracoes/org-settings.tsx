'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/hooks/use-toast'
import { getRoleLabel, getRoleBadgeColor, canAccess } from '@/lib/auth/roles'
import { Building2, UserPlus, Shield, Crown, Users, Trash2, Mail } from 'lucide-react'
import type { UserRole, OrgMembro, Organizacao, OrgMembroStatus } from '@/types/database'

interface Props {
  userId: string
  orgMembro: OrgMembro | null
  orgMembros: OrgMembro[]
  organizacao: Organizacao | null
}

export function OrgSettingsContent({ userId, orgMembro, orgMembros: initialMembros, organizacao: initialOrg }: Props) {
  const supabase = createClient()
  const [org, setOrg] = useState(initialOrg)
  const [membros, setMembros] = useState(initialMembros)
  const [showCreateOrg, setShowCreateOrg] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [orgForm, setOrgForm] = useState({ nome: '', cnpj: '' })
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('user')

  const userRole = orgMembro?.role || 'admin'
  const isAdmin = userRole === 'admin'
  const isManagerOrAbove = canAccess(userRole, 'manager')

  async function createOrg() {
    if (!orgForm.nome.trim()) { toast('Nome da organização é obrigatório', 'error'); return }
    const { data: newOrg, error } = await supabase
      .from('organizacoes')
      .insert({ nome: orgForm.nome.trim(), cnpj: orgForm.cnpj || null })
      .select()
      .single()
    if (error || !newOrg) { toast(error?.message || 'Erro ao criar organização', 'error'); return }

    // Add self as admin
    const { error: membroError } = await supabase
      .from('org_membros')
      .insert({ org_id: newOrg.id, user_id: userId, role: 'admin' as UserRole, status: 'ativo' as OrgMembroStatus })
    if (membroError) { toast(membroError.message, 'error'); return }

    // Update profile with org_id
    await supabase.from('profiles').update({ org_id: newOrg.id }).eq('id', userId)

    setOrg(newOrg)
    setShowCreateOrg(false)
    toast('Organização criada!', 'success')
    window.location.reload()
  }

  async function inviteMember() {
    if (!inviteEmail.trim()) { toast('Email é obrigatório', 'error'); return }
    if (!org) return

    // Find user by email in profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', inviteEmail.trim())
      .single()

    if (!profile) {
      toast('Usuário não encontrado. Ele precisa se registrar primeiro.', 'error')
      return
    }

    // Check if already member
    const existing = membros.find((m) => (m.profiles as { email: string | null } | null)?.email === inviteEmail.trim())
    if (existing) {
      toast('Este usuário já faz parte da organização', 'error')
      return
    }

    const { error } = await supabase.from('org_membros').insert({
      org_id: org.id,
      user_id: profile.id,
      role: inviteRole,
      convidado_por: userId,
      status: 'ativo' as OrgMembroStatus,
    })
    if (error) { toast(error.message, 'error'); return }

    // Update invited user's profile with org_id
    await supabase.from('profiles').update({ org_id: org.id }).eq('id', profile.id)

    toast('Membro adicionado!', 'success')
    setShowInvite(false)
    setInviteEmail('')
    window.location.reload()
  }

  async function updateMemberRole(membroId: string, newRole: UserRole) {
    const { error } = await supabase.from('org_membros').update({ role: newRole }).eq('id', membroId)
    if (error) { toast(error.message, 'error'); return }
    setMembros((prev) => prev.map((m) => m.id === membroId ? { ...m, role: newRole } : m))
    toast('Role atualizado!', 'success')
  }

  async function removeMember(membroId: string, membroUserId: string) {
    if (membroUserId === userId) { toast('Você não pode se remover da organização', 'error'); return }
    if (!confirm('Remover este membro da organização?')) return
    const { error } = await supabase.from('org_membros').delete().eq('id', membroId)
    if (error) { toast(error.message, 'error'); return }
    await supabase.from('profiles').update({ org_id: null }).eq('id', membroUserId)
    setMembros((prev) => prev.filter((m) => m.id !== membroId))
    toast('Membro removido', 'info')
  }

  async function updateOrgName(nome: string) {
    if (!org || !nome.trim()) return
    const { error } = await supabase.from('organizacoes').update({ nome: nome.trim() }).eq('id', org.id)
    if (error) { toast(error.message, 'error'); return }
    setOrg((prev) => prev ? { ...prev, nome: nome.trim() } : null)
    toast('Nome atualizado!', 'success')
  }

  // No organization — show create or solo mode
  if (!org) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Configurações</h2>
          <p className="text-sm text-gray-500 mt-1">Gerencie sua organização e equipe</p>
        </div>

        <div className="glass-card rounded-2xl p-8 text-center max-w-lg mx-auto">
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
            <div className="space-y-3 text-left">
              <input
                value={orgForm.nome}
                onChange={(e) => setOrgForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Nome da empresa *"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white"
              />
              <input
                value={orgForm.cnpj}
                onChange={(e) => setOrgForm((f) => ({ ...f, cnpj: e.target.value }))}
                placeholder="CNPJ (opcional)"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white"
              />
              <div className="flex gap-2">
                <button onClick={() => setShowCreateOrg(false)} className="flex-1 py-3 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all">
                  Cancelar
                </button>
                <button onClick={createOrg} className="flex-1 py-3 bg-sand-500 hover:bg-sand-600 text-white font-medium rounded-2xl btn-press transition-all">
                  Criar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Has organization — show settings
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Configurações</h2>
        <p className="text-sm text-gray-500 mt-1">Gerencie sua organização e equipe</p>
      </div>

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
      {showInvite && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="modal-glass modal-animate w-full max-w-md rounded-3xl shadow-2xl dark:bg-gray-900 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5" /> Convidar Membro
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Email do usuário</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                    type="email"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">O usuário precisa ter uma conta no STRKTR</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Papel</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white"
                >
                  <option value="user">Usuário</option>
                  <option value="manager">Gerente</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => { setShowInvite(false); setInviteEmail('') }} className="flex-1 py-3 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all">
                  Cancelar
                </button>
                <button onClick={inviteMember} className="flex-1 py-3 bg-sand-500 hover:bg-sand-600 text-white font-medium rounded-2xl btn-press transition-all">
                  Convidar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
