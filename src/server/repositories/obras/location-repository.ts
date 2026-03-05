import type { SupabaseClient } from '@supabase/supabase-js'
import type { ObraLocationSource } from '@/shared/types/obra-location'

export async function fetchObraLocationByOrg(
  supabase: SupabaseClient,
  obraId: string,
  orgId: string
) {
  return supabase
    .from('obra_geolocations')
    .select('obra_id, lat, lng, source, updated_at')
    .eq('obra_id', obraId)
    .eq('org_id', orgId)
    .maybeSingle()
}

export async function upsertObraLocationByOrg(
  supabase: SupabaseClient,
  params: {
    orgId: string
    obraId: string
    lat: number
    lng: number
    source: ObraLocationSource
    userId: string
  }
) {
  const { orgId, obraId, lat, lng, source, userId } = params
  return supabase
    .from('obra_geolocations')
    .upsert(
      {
        org_id: orgId,
        obra_id: obraId,
        lat,
        lng,
        source,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id,obra_id' }
    )
    .select('obra_id, lat, lng, source, updated_at')
    .single()
}

