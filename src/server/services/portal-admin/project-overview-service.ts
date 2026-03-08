import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  PortalAdminProjectInfo,
  PortalAdminProjectLinkedObra,
  PortalAdminProjectOverviewPayload,
} from '@/shared/types/portal-admin'
import { getPortalAdminObraActivity } from '@/server/services/portal-admin/obra-activity-service'
import { getPortalAdminObraOverview } from '@/server/services/portal-admin/obra-overview-service'

type ProjetoRow = PortalAdminProjectInfo
type LinkedObraRow = PortalAdminProjectLinkedObra

export async function getPortalAdminProjectOverview({
  supabase,
  orgId,
  projectId,
}: {
  supabase: SupabaseClient
  orgId: string
  projectId: string
}): Promise<PortalAdminProjectOverviewPayload | null> {
  const { data: projeto, error: projetoError } = await supabase
    .from('projetos')
    .select('id, nome, cliente, status, obra_id')
    .eq('org_id', orgId)
    .eq('id', projectId)
    .maybeSingle()

  if (projetoError) {
    throw new Error(projetoError.message)
  }
  if (!projeto) {
    return null
  }

  if (!projeto.obra_id) {
    return {
      projeto: projeto as ProjetoRow,
      linkedObra: null,
      overview: null,
      activity: null,
    }
  }

  const [obraRes, overview, activity] = await Promise.all([
    supabase
      .from('obras')
      .select('id, nome, cliente, status')
      .eq('org_id', orgId)
      .eq('id', projeto.obra_id)
      .maybeSingle(),
    getPortalAdminObraOverview({
      supabase,
      orgId,
      obraId: projeto.obra_id,
    }),
    getPortalAdminObraActivity({
      supabase,
      orgId,
      obraId: projeto.obra_id,
    }),
  ])

  if (obraRes.error) {
    throw new Error(obraRes.error.message)
  }

  return {
    projeto: projeto as ProjetoRow,
    linkedObra: (obraRes.data || null) as LinkedObraRow | null,
    overview,
    activity,
  }
}
