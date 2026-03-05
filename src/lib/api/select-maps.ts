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

export const DIARIO_OBRA_SELECT =
  'id, obra_id, user_id, org_id, tipo, titulo, descricao, metadata, created_at'

export const OBRA_ETAPA_SELECT =
  'id, obra_id, user_id, org_id, cronograma_item_id, nome, descricao, status, ordem, data_inicio, data_fim, responsavel, created_at'

export const OBRA_CHECKLIST_SELECT =
  'id, obra_id, user_id, org_id, tipo, nome, ordem, created_at'

export const CRONOGRAMA_OBRA_SELECT =
  'id, org_id, obra_id, user_id, nome, calendario, data_inicio_planejada, data_fim_planejada, created_at, updated_at'

export const CRONOGRAMA_ITEM_SELECT =
  'id, cronograma_id, org_id, obra_id, user_id, nome, descricao, tipo, status, empresa_responsavel, responsavel, data_inicio_planejada, data_fim_planejada, duracao_dias, data_inicio_real, data_fim_real, progresso, atraso_dias, ordem, metadata, created_at, updated_at'

export const CRONOGRAMA_DEPENDENCIA_SELECT =
  'id, cronograma_id, org_id, predecessor_item_id, successor_item_id, tipo, lag_dias, created_at'

export const CRONOGRAMA_BASELINE_SELECT =
  'id, cronograma_id, org_id, versao, snapshot, created_by, created_at'

export const ROADMAP_ACTION_SELECT =
  'id, org_id, user_id, profile_type, action_code, title, description, status, due_at, source_module, metadata, created_at, completed_at'
