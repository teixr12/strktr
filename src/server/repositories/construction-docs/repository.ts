import type { SupabaseClient } from '@supabase/supabase-js'

export async function ensureProjectLink(
  supabase: SupabaseClient,
  orgId: string,
  projectId: string,
  userId: string,
  obraId: string | null
) {
  const { data: existing } = await supabase
    .from('construction_docs_project_links')
    .select('id, org_id, project_id, obra_id, created_by, created_at, updated_at')
    .eq('org_id', orgId)
    .eq('project_id', projectId)
    .maybeSingle()

  if (existing) return existing

  const { data, error } = await supabase
    .from('construction_docs_project_links')
    .insert({
      org_id: orgId,
      project_id: projectId,
      obra_id: obraId,
      created_by: userId,
      updated_at: new Date().toISOString(),
    })
    .select('id, org_id, project_id, obra_id, created_by, created_at, updated_at')
    .single()

  if (error) throw error
  return data
}

export async function ensureProjectOwnership(
  supabase: SupabaseClient,
  orgId: string,
  projectId: string
) {
  const { data, error } = await supabase
    .from('projetos')
    .select('id, obra_id')
    .eq('org_id', orgId)
    .eq('id', projectId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function ensureVisitOwnership(
  supabase: SupabaseClient,
  orgId: string,
  visitId: string
) {
  const { data, error } = await supabase
    .from('construction_docs_visits')
    .select('id, org_id, project_link_id, type, visit_date, metadata, created_by, created_at, updated_at')
    .eq('org_id', orgId)
    .eq('id', visitId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function ensurePhotoOwnership(
  supabase: SupabaseClient,
  orgId: string,
  photoId: string
) {
  const { data, error } = await supabase
    .from('construction_docs_photos')
    .select('id, org_id, visit_id')
    .eq('org_id', orgId)
    .eq('id', photoId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function ensureTemplateOwnership(
  supabase: SupabaseClient,
  orgId: string,
  templateId: string
) {
  const { data, error } = await supabase
    .from('construction_docs_templates')
    .select('id, org_id, doc_type, name, dsl, version, is_active, created_by, created_at, updated_at')
    .eq('org_id', orgId)
    .eq('id', templateId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function ensureDocumentOwnership(
  supabase: SupabaseClient,
  orgId: string,
  documentId: string
) {
  const { data, error } = await supabase
    .from('construction_docs_documents')
    .select('id, org_id, project_id, obra_id, type, status, payload, rendered_html, pdf_key, created_by, updated_by, created_at, updated_at')
    .eq('org_id', orgId)
    .eq('id', documentId)
    .maybeSingle()
  if (error) throw error
  return data
}

