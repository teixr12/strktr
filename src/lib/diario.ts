import type { SupabaseClient } from '@supabase/supabase-js'
import type { DiarioTipo } from '@/types/database'

export async function logDiario(
  supabase: SupabaseClient,
  obra_id: string,
  user_id: string,
  tipo: DiarioTipo,
  titulo: string,
  descricao?: string,
  metadata?: Record<string, unknown>
) {
  return supabase.from('diario_obra').insert({
    obra_id,
    user_id,
    tipo,
    titulo,
    descricao: descricao || null,
    metadata: metadata || {},
  })
}
