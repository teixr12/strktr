import type { SupabaseClient } from '@supabase/supabase-js'
import type { NotificacaoTipo } from '@/types/database'

interface CreateNotificationParams {
  supabase: SupabaseClient
  user_id: string
  tipo: NotificacaoTipo
  titulo: string
  descricao?: string
  link?: string
}

export async function createNotification({
  supabase,
  user_id,
  tipo,
  titulo,
  descricao,
  link,
}: CreateNotificationParams) {
  const { data, error } = await supabase
    .from('notificacoes')
    .insert({
      user_id,
      tipo,
      titulo,
      descricao: descricao || null,
      link: link || null,
    })
    .select()
    .single()

  if (error) {
    console.error('[Notifications] Erro ao criar:', error)
    return null
  }

  return data
}

export async function markAsRead(supabase: SupabaseClient, notificationId: string) {
  return supabase
    .from('notificacoes')
    .update({ lida: true })
    .eq('id', notificationId)
}

export async function markAllAsRead(supabase: SupabaseClient, userId: string) {
  return supabase
    .from('notificacoes')
    .update({ lida: true })
    .eq('user_id', userId)
    .eq('lida', false)
}

export async function getUnreadCount(supabase: SupabaseClient, userId: string) {
  const { count } = await supabase
    .from('notificacoes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('lida', false)

  return count || 0
}
