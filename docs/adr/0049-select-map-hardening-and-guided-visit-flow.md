# 0049 — Select-map hardening em APIs core + fluxo guiado real de visita (Construction Docs)

## Status
Accepted — 2026-03-05

## Contexto
- O hardening pós-100% técnico ainda tinha endpoints core usando `select('*')`, elevando risco de overfetch e drift de contrato ao escalar.
- O fluxo `/construction-docs/projects/[projectId]/visits/new` ainda era placeholder, sem criação real de visita.
- A política do repositório exige mudanças aditivas, sem breaking em `/api/v1`, com rollback simples.

## Decisão
1. Introduzir um mapa central de projeções em `src/lib/api/select-maps.ts` para consultas core:
   - `OBRA_SELECT`
   - `LEAD_SELECT`
   - `ORG_MEMBER_SELECT`
   - `PROJECT_FOR_CONVERSION_SELECT`
   - `AUTOMATION_RULE_SELECT`
   - `AUTOMATION_RUN_SELECT`
2. Migrar endpoints e serviços críticos para projeções explícitas, preservando envelope e semântica:
   - obras (`GET /api/v1/obras`, `GET /api/v1/obras/:id`)
   - leads (`GET /api/v1/leads/:id`)
   - config org/org-members (membership selects)
   - projetos convert-to-obra
   - automation rules/jobs + service layer
3. Substituir o placeholder do fluxo guiado de visitas por fluxo real de 3 etapas com persistência em backend:
   - página `.../visits/new` renderiza componente client com criação de visita e ambientes iniciais
   - redireciona para a visita criada após sucesso

## Consequências
### Positivas
- Menor overfetch em rotas de tráfego alto.
- Governança de queries mais previsível e reutilizável para próximas PRs.
- Discoverability/onboarding de Construction Docs deixa de depender de redirect informativo.

### Trade-offs
- Mais manutenção explícita de colunas ao evoluir schema.
- Fluxo guiado adiciona UI state no cliente, exigindo cobertura contínua de smoke.

## Segurança e compatibilidade
- Sem remoção/rename de endpoints.
- Sem mudança destrutiva de schema.
- Envelope canônico mantido.
- Mudança totalmente reversível por deploy rollback (sem migração).

## Rollback
1. Reverter commit desta ADR e dos arquivos de seletor/fluxo guiado.
2. Restaurar os selects anteriores por endpoint, se necessário.
3. Voltar a página de visita guiada para o estado anterior (placeholder) em incidente crítico.
