'use client'

import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { apiRequest } from '@/lib/api/client'
import { featureFlags } from '@/lib/feature-flags'
import { toast } from '@/hooks/use-toast'
import { fmtDate } from '@/lib/utils'
import { Save, Lock, User, Eye, EyeOff } from 'lucide-react'
import { PageHeader } from '@/components/ui/enterprise'
import { FormField, FormInput } from '@/components/ui/form-field'
import type { Profile } from '@/types/database'
import type { UiAvatarSource } from '@/shared/types/ui'

interface Props { profile: Profile | null }

const profileFormSchema = z.object({
  nome: z.string().trim().min(2, 'Nome é obrigatório'),
  telefone: z.string().trim().optional(),
  empresa: z.string().trim().optional(),
  cargo: z.string().trim().optional(),
  avatar_url: z.string().optional(),
})
type ProfileFormValues = z.infer<typeof profileFormSchema>

const passwordFormSchema = z.object({
  nova: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
  confirmar: z.string().min(1, 'Confirme a senha'),
}).refine((data) => data.nova === data.confirmar, {
  message: 'As senhas não coincidem',
  path: ['confirmar'],
})
type PasswordFormValues = z.infer<typeof passwordFormSchema>

export function PerfilContent({ profile }: Props) {
  const useV2 = featureFlags.uiTailadminV1 && featureFlags.uiV2Perfil
  const useAvatarV2 = featureFlags.profileAvatarV2
  const [saving, setSaving] = useState(false)
  const [changingPw, setChangingPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [failedAvatarSrc, setFailedAvatarSrc] = useState<string | null>(null)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema) as never,
    defaultValues: {
      nome: profile?.nome || '',
      telefone: profile?.telefone || '',
      empresa: profile?.empresa || '',
      cargo: profile?.cargo || '',
      avatar_url: profile?.avatar_url || '',
    },
  })

  const { register: registerPw, handleSubmit: handleSubmitPw, reset: resetPw, formState: { errors: pwErrors } } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema) as never,
    defaultValues: { nova: '', confirmar: '' },
  })

  const watchedNome = watch('nome')
  const watchedAvatarUrl = watch('avatar_url')

  const fallbackAvatar = useMemo(
    () =>
      `https://ui-avatars.com/api/?name=${encodeURIComponent(
        watchedNome || 'U'
      )}&background=d4a373&color=fff&size=128`,
    [watchedNome]
  )

  const canUseCustomAvatar = useMemo(
    () =>
      useAvatarV2 &&
      (watchedAvatarUrl || '').trim().startsWith('http') &&
      (watchedAvatarUrl || '').trim() !== failedAvatarSrc,
    [watchedAvatarUrl, failedAvatarSrc, useAvatarV2]
  )

  const avatarUrl = canUseCustomAvatar ? (watchedAvatarUrl || '') : fallbackAvatar
  const avatarSource: UiAvatarSource =
    canUseCustomAvatar ? 'profile' : 'fallback'

  async function onProfileSubmit(values: ProfileFormValues) {
    const trimmedAvatar = (values.avatar_url || '').trim()
    if (useAvatarV2 && trimmedAvatar) {
      try {
        const parsed = new URL(trimmedAvatar)
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          toast('Use uma URL de avatar válida (http/https)', 'error')
          return
        }
      } catch {
        toast('Use uma URL de avatar válida (http/https)', 'error')
        return
      }
    }

    setSaving(true)
    const payload = {
      nome: values.nome.trim(),
      telefone: values.telefone || null,
      empresa: values.empresa || null,
      cargo: values.cargo || null,
      avatar_url: useAvatarV2 ? trimmedAvatar || null : undefined,
    }
    try {
      await apiRequest<Profile>('/api/v1/perfil', { method: 'PATCH', body: payload })
      toast('Perfil atualizado!', 'success')
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erro ao atualizar perfil')
      toast(error.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function onPasswordSubmit(values: PasswordFormValues) {
    setChangingPw(true)
    try {
      await apiRequest<{ success: boolean }>('/api/v1/perfil/password', {
        method: 'POST',
        body: { password: values.nova },
      })
      toast('Senha alterada com sucesso!', 'success')
      resetPw()
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erro ao alterar senha')
      toast(error.message, 'error')
    } finally {
      setChangingPw(false)
    }
  }

  return (
    <div className={`${useV2 ? 'tailadmin-page' : 'p-4 md:p-6'} mx-auto max-w-2xl space-y-6`}>
      <PageHeader title="Perfil" subtitle="Atualize suas informações e segurança de acesso" />

      {/* Header */}
      <div className="glass-card rounded-3xl p-6 flex items-center gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt="Avatar"
          className="h-20 w-20 rounded-2xl border-2 border-white object-cover shadow-lg dark:border-gray-700"
          onError={() => setFailedAvatarSrc((watchedAvatarUrl || '').trim())}
          referrerPolicy="no-referrer"
        />
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{watchedNome || 'Usuário'}</h2>
          <p className="text-sm text-gray-500">{profile?.email || ''}</p>
          {profile?.empresa && <p className="text-xs text-sand-600 dark:text-sand-400 mt-0.5">{profile.empresa}</p>}
          <p className="text-[11px] text-gray-400 mt-1">
            Avatar {avatarSource === 'profile' ? 'personalizado' : 'padrão'}
          </p>
        </div>
      </div>

      {/* Profile Form */}
      <form onSubmit={handleSubmit(onProfileSubmit)} className="glass-card rounded-3xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <User className="w-5 h-5 text-sand-600 dark:text-sand-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Informações Pessoais</h3>
        </div>

        <div className="space-y-3">
          <FormField label="Nome" error={errors.nome} required>
            <FormInput registration={register('nome')} hasError={!!errors.nome} />
          </FormField>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">Email</label>
            <input value={profile?.email || ''} disabled className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-500 cursor-not-allowed" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Telefone" error={errors.telefone}>
              <FormInput registration={register('telefone')} hasError={!!errors.telefone} />
            </FormField>
            <FormField label="Cargo" error={errors.cargo}>
              <FormInput registration={register('cargo')} hasError={!!errors.cargo} />
            </FormField>
          </div>

          <FormField label="Empresa" error={errors.empresa}>
            <FormInput registration={register('empresa')} hasError={!!errors.empresa} />
          </FormField>

          {useAvatarV2 ? (
            <div>
              <FormField label="URL do avatar">
                <FormInput registration={register('avatar_url')} placeholder="https://..." />
              </FormField>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setValue('avatar_url', '')}
                  className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100"
                >
                  Resetar avatar
                </button>
              </div>
            </div>
          ) : null}

          {profile?.created_at && (
            <p className="text-xs text-gray-400 pt-2">Membro desde {fmtDate(profile.created_at)}</p>
          )}

          <button type="submit" disabled={saving} className="w-full flex items-center justify-center gap-2 py-3 bg-sand-500 hover:bg-sand-600 disabled:opacity-50 text-white font-medium rounded-2xl btn-press transition-all text-sm mt-2">
            <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>

      {/* Password */}
      <form onSubmit={handleSubmitPw(onPasswordSubmit)} className="glass-card rounded-3xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Lock className="w-5 h-5 text-sand-600 dark:text-sand-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Alterar Senha</h3>
        </div>

        <div className="space-y-3">
          <FormField label="Nova Senha" error={pwErrors.nova}>
            <div className="relative">
              <input
                type={showNewPw ? 'text' : 'password'}
                {...registerPw('nova')}
                placeholder="Mínimo 6 caracteres"
                className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border rounded-xl text-sm focus:outline-none focus:ring-2 dark:text-white pr-10 transition-colors ${
                  pwErrors.nova
                    ? 'border-red-300 focus:ring-red-400/50 dark:border-red-700'
                    : 'border-gray-200 focus:ring-sand-400 dark:border-gray-700'
                }`}
              />
              <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </FormField>
          <FormField label="Confirmar Senha" error={pwErrors.confirmar}>
            <div className="relative">
              <input
                type={showConfirmPw ? 'text' : 'password'}
                {...registerPw('confirmar')}
                placeholder="Repita a senha"
                className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border rounded-xl text-sm focus:outline-none focus:ring-2 dark:text-white pr-10 transition-colors ${
                  pwErrors.confirmar
                    ? 'border-red-300 focus:ring-red-400/50 dark:border-red-700'
                    : 'border-gray-200 focus:ring-sand-400 dark:border-gray-700'
                }`}
              />
              <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </FormField>
          <button type="submit" disabled={changingPw} className="w-full flex items-center justify-center gap-2 py-3 bg-gray-800 dark:bg-gray-700 hover:bg-gray-900 dark:hover:bg-gray-600 disabled:opacity-50 text-white font-medium rounded-2xl btn-press transition-all text-sm">
            <Lock className="w-4 h-4" /> {changingPw ? 'Alterando...' : 'Alterar Senha'}
          </button>
        </div>
      </form>
    </div>
  )
}
