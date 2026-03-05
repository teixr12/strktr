export const OBRA_SELECT =
  'id, user_id, org_id, nome, cliente, local, tipo, valor_contrato, valor_gasto, progresso, status, etapa_atual, area_m2, data_inicio, data_previsao, data_conclusao, descricao, cor, icone, notas, created_at, updated_at'

export const LEAD_SELECT =
  'id, user_id, org_id, nome, email, telefone, empresa, origem, status, temperatura, valor_potencial, tipo_projeto, local, notas, ultimo_contato, created_at, updated_at'

export const ORG_MEMBER_SELECT =
  'id, org_id, user_id, role, convidado_por, status, created_at'

export const PROJECT_FOR_CONVERSION_SELECT =
  'id, nome, cliente, local, tipo, valor_estimado, area_m2, data_inicio_prev, data_fim_prev, descricao, notas, obra_id'

export const AUTOMATION_RULE_SELECT =
  'id, org_id, trigger, template_code, enabled, requires_review, cooldown_hours, created_by, metadata, created_at, updated_at'

export const AUTOMATION_RUN_SELECT =
  'id, org_id, rule_id, trigger, trigger_entity_type, trigger_entity_id, status, summary, error, requires_review, run_source, preview, result, created_by, created_at'
