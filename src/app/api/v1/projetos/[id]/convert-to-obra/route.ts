import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }
  const permissionError = requireDomainPermission(request, role, 'can_manage_projects')
  if (permissionError) return permissionError

  const { id } = await params
  const { data: projeto, error: projetoError } = await supabase
    .from('projetos')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (projetoError || !projeto) {
    return fail(
      request,
      { code: API_ERROR_CODES.NOT_FOUND, message: projetoError?.message || 'Projeto não encontrado' },
      404
    )
  }

  if (projeto.obra_id) {
    return fail(
      request,
      { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'Projeto já está vinculado a uma obra' },
      400
    )
  }

  const { data: obra, error: obraError } = await supabase
    .from('obras')
    .insert({
      user_id: user.id,
      org_id: orgId,
      nome: projeto.nome,
      cliente: projeto.cliente || '',
      local: projeto.local || '',
      tipo: projeto.tipo,
      status: 'Orçamento',
      valor_contrato: projeto.valor_estimado || 0,
      valor_gasto: 0,
      progresso: 0,
      area_m2: projeto.area_m2 || null,
      data_inicio: projeto.data_inicio_prev || null,
      data_previsao: projeto.data_fim_prev || null,
      descricao: projeto.descricao || null,
      cor: '#d4a373',
      icone: 'home',
      notas: projeto.notas || null,
    })
    .select()
    .single()

  if (obraError || !obra) {
    log('error', 'projetos.convert_to_obra.create_failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/projetos/[id]/convert-to-obra',
      projetoId: id,
      error: obraError?.message || 'unknown',
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: obraError?.message || 'Erro ao criar obra' },
      500
    )
  }

  const { data: updatedProjeto, error: updateError } = await supabase
    .from('projetos')
    .update({ obra_id: obra.id, status: 'Em Execução' })
    .eq('id', id)
    .eq('org_id', orgId)
    .select('*, leads(nome), obras(nome)')
    .single()

  if (updateError) {
    log('error', 'projetos.convert_to_obra.link_failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/projetos/[id]/convert-to-obra',
      projetoId: id,
      obraId: obra.id,
      error: updateError.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: updateError.message }, 500)
  }

  return ok(request, { projeto: updatedProjeto, obra }, undefined, 201)
}
