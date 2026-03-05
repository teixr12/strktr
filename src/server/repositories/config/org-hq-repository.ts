import type { SupabaseClient } from '@supabase/supabase-js'
import type { AddressFields, ObraLocationSource } from '@/shared/types/obra-location'

export async function fetchOrgHqLocationByOrg(supabase: SupabaseClient, orgId: string) {
  return supabase
    .from('org_hq_locations')
    .select('org_id, lat, lng, source, updated_at, cep, logradouro, numero, complemento, bairro, cidade, estado, formatted_address')
    .eq('org_id', orgId)
    .maybeSingle()
}

export async function upsertOrgHqLocationByOrg(
  supabase: SupabaseClient,
  params: {
    orgId: string
    lat: number
    lng: number
    source: ObraLocationSource
    userId: string
    address?: Partial<AddressFields>
  }
) {
  const { orgId, lat, lng, source, userId, address } = params
  return supabase
    .from('org_hq_locations')
    .upsert(
      {
        org_id: orgId,
        lat,
        lng,
        source,
        cep: address?.cep || null,
        logradouro: address?.logradouro || null,
        numero: address?.numero || null,
        complemento: address?.complemento || null,
        bairro: address?.bairro || null,
        cidade: address?.cidade || null,
        estado: address?.estado || null,
        formatted_address: address?.formatted_address || null,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id' }
    )
    .select('org_id, lat, lng, source, updated_at, cep, logradouro, numero, complemento, bairro, cidade, estado, formatted_address')
    .single()
}
