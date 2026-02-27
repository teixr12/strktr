# ADR 0006: Roadmap Personalizado + Automação Semi-Autônoma

## Contexto
O STRKTR precisava evoluir de alertas genéricos para orientação operacional personalizada por perfil, além de automações pós-criação que reduzam inércia de execução sem comprometer segurança de produção.

## Decisão
1. Introduzir `roadmap_actions` por usuário/org, com ações priorizadas por perfil (`owner`, `manager`, `architect`, `finance`, `field`).
2. Introduzir automação semi-autônoma com trilha auditável (`automation_rules`, `automation_runs`, `automation_outbox`) e idempotência por `action_key`.
3. Conectar gatilhos iniciais não-destrutivos: `LeadCreated`, `ObraCreated`, `ApprovalRejected`.
4. Controlar rollout por feature flags:
   - `NEXT_PUBLIC_FF_PERSONAL_ROADMAP`
   - `NEXT_PUBLIC_FF_SEMI_AUTOMATION`
   - `NEXT_PUBLIC_FF_BEHAVIOR_PROMPTS`
5. Manter política de segurança org-first (RLS) e envelope canônico de API.

## Trade-offs
- Prós: ganho rápido de adoção e ação operacional, alta auditabilidade, baixo risco de regressão por rollout com flags.
- Contras: duplicidade parcial de lógica de priorização inicial (heurística), exigindo futura consolidação em policy engine.

## Rollback
1. Desligar flags novas (kill-switch) sem rollback de schema.
2. Desativar regras de automação (`enabled=false`) se houver ruído operacional.
3. Reverter deployment somente se houver regressão crítica de UX/API.

## Impacto
- Produto: usuários recebem “plano de hoje” acionável e automação assistida.
- Engenharia: novo domínio roadmap/automation com contratos API v1 e trilha de execução.
- Operação: monitoramento por `automation_runs` e métricas de conclusão de roadmap.
