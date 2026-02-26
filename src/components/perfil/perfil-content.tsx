'use client'

import { useState } from 'react'
import Image from 'next/image'
import { apiRequest } from '@/lib/api/client'
import { toast } from '@/hooks/use-toast'
import { fmtDate } from '@/lib/utils'
import { Save, Lock, User, Eye, EyeOff } from 'lucide-react'
import type { Profile } from '@/types/database'

interface Props { profile: Profile | null }

export function PerfilContent({ profile }: Props) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nome: profile?.nome || '',
    telefone: profile?.telefone || '',
    empresa: profile?.empresa || '',
    cargo: profile?.cargo || '',
  })
  const [pwForm, setPwForm] = useState({ nova: '', confirmar: '' })
  const [changingPw, setChangingPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)

  async function saveProfile() {
    if (!form.nome.trim()) { toast('Nome é obrigatório', 'error'); return }
    setSaving(true)
    const payload = {
      nome: form.nome.trim(),
      telefone: form.telefone || null,
      empresa: form.empresa || null,
      cargo: form.cargo || null,
    }
    let error: Error | null = null
    try {
      await apiRequest<Profile>('/api/v1/perfil', { method: 'PATCH', body: payload })
    } catch (err) {
      error = err instanceof Error ? err : new Error('Erro ao atualizar perfil')
    }
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Perfil atualizado!', 'success')
  }

  async function changePassword() {
    if (!pwForm.nova || pwForm.nova.length < 6) { toast('A senha deve ter pelo menos 6 caracteres', 'error'); return }
    if (pwForm.nova !== pwForm.confirmar) { toast('As senhas não coincidem', 'error'); return }
    setChangingPw(true)
    let error: Error | null = null
    try {
      await apiRequest<{ success: boolean }>('/api/v1/perfil/password', {
        method: 'POST',
        body: { password: pwForm.nova },
      })
    } catch (err) {
      error = err instanceof Error ? err : new Error('Erro ao alterar senha')
    }
    setChangingPw(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Senha alterada com sucesso!', 'success')
    setPwForm({ nova: '', confirmar: '' })
  }

  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(form.nome || 'U')}&background=d4a373&color=fff&size=128`

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="glass-card rounded-3xl p-6 flex items-center gap-5">
        <Image src={avatarUrl} alt="Avatar" width={80} height={80} className="w-20 h-20 rounded-2xl border-2 border-white dark:border-gray-700 shadow-lg" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{form.nome || 'Usuário'}</h2>
          <p className="text-sm text-gray-500">{profile?.email || ''}</p>
          {profile?.empresa && <p className="text-xs text-sand-600 dark:text-sand-400 mt-0.5">{profile.empresa}</p>}
        </div>
      </div>

      {/* Profile Form */}
      <div className="glass-card rounded-3xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <User className="w-5 h-5 text-sand-600 dark:text-sand-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Informações Pessoais</h3>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Nome *</label>
            <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white" />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Email</label>
            <input value={profile?.email || ''} disabled className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-500 cursor-not-allowed" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Telefone</label>
              <input value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Cargo</label>
              <input value={form.cargo} onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white" />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Empresa</label>
            <input value={form.empresa} onChange={(e) => setForm((f) => ({ ...f, empresa: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white" />
          </div>

          {profile?.created_at && (
            <p className="text-xs text-gray-400 pt-2">Membro desde {fmtDate(profile.created_at)}</p>
          )}

          <button onClick={saveProfile} disabled={saving} className="w-full flex items-center justify-center gap-2 py-3 bg-sand-500 hover:bg-sand-600 disabled:opacity-50 text-white font-medium rounded-2xl btn-press transition-all text-sm mt-2">
            <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

      {/* Password */}
      <div className="glass-card rounded-3xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Lock className="w-5 h-5 text-sand-600 dark:text-sand-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Alterar Senha</h3>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Nova Senha</label>
            <div className="relative">
              <input type={showNewPw ? 'text' : 'password'} value={pwForm.nova} onChange={(e) => setPwForm((f) => ({ ...f, nova: e.target.value }))} placeholder="Mínimo 6 caracteres" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white pr-10" />
              <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Confirmar Senha</label>
            <div className="relative">
              <input type={showConfirmPw ? 'text' : 'password'} value={pwForm.confirmar} onChange={(e) => setPwForm((f) => ({ ...f, confirmar: e.target.value }))} placeholder="Repita a senha" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white pr-10" />
              <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button onClick={changePassword} disabled={changingPw} className="w-full flex items-center justify-center gap-2 py-3 bg-gray-800 dark:bg-gray-700 hover:bg-gray-900 dark:hover:bg-gray-600 disabled:opacity-50 text-white font-medium rounded-2xl btn-press transition-all text-sm">
            <Lock className="w-4 h-4" /> {changingPw ? 'Alterando...' : 'Alterar Senha'}
          </button>
        </div>
      </div>
    </div>
  )
}
