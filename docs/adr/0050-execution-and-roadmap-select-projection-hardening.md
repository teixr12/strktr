# 0050 — Hardening de projeções em Execution + Roadmap (sem breaking)

## Status
Accepted — 2026-03-05

## Contexto
- Após o fechamento técnico core, ainda havia `select('*')` concentrado em rotas de execução de obra (`etapas`, `cronograma`, `diário`, `checklists`) e no domínio de roadmap.
- Esse padrão aumenta payload e risco de drift de contrato ao crescer o schema.
- A política atual exige mudanças aditivas, sem rename/remove em `/api/v1`.

## Decisão
1. Expandir `src/lib/api/select-maps.ts` com projeções explícitas para:
   - `diario_obra`
   - `obra_etapas`
   - `obra_checklists`
   - `cronograma_obras`
   - `cronograma_itens`
   - `cronograma_dependencias`
   - `cronograma_baselines`
   - `roadmap_actions`
2. Migrar endpoints/serviços com maior tráfego para os novos mapas.
3. Manter temporariamente `select('*')` apenas nas rotas de `checklist_items` que possuem fallback de compatibilidade de coluna (`data_limite`) para evitar regressão em ambientes parcialmente migrados.

## Consequências
### Positivas
- Redução relevante de overfetch em rotas críticas de execução.
- Padronização de governança de payload em domínios operacionais.
- Menor acoplamento implícito a futuras colunas adicionadas no banco.

### Trade-offs
- Necessidade de manter mapas de seleção sincronizados com schema.
- `checklist_items` permanece com wildcard temporário por segurança de compatibilidade.

## Compatibilidade e segurança
- Sem mudanças destrutivas de schema.
- Sem alteração de contrato externo (`/api/v1` mantém envelope e semântica).
- Rollback simples via revert de commit/PR.

## Rollback
1. Reverter commit de hardening (mapas + uso nas rotas).
2. Restaurar selects anteriores por endpoint em caso de incidente.
3. Sem necessidade de rollback de banco.
