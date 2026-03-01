-- Performance optimization: add composite indexes for frequently queried patterns
-- These indexes target specific query patterns found in API routes and services

-- Portal sessions: fast token-based lookups (session-service.ts)
-- Query pattern: WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > $2
create index if not exists idx_portal_sessions_token_active
  on public.portal_sessions (token_hash, revoked_at, expires_at)
  where revoked_at is null;

-- Compras: filter by org + status (compras/route.ts GET)
-- Query pattern: WHERE org_id = $1 AND status = $2 ORDER BY created_at DESC
create index if not exists idx_compras_org_status_created
  on public.compras (org_id, status, created_at desc);

-- Leads: filter by org + status (leads/route.ts GET)
-- Query pattern: WHERE org_id = $1 AND status = $2 ORDER BY created_at DESC
create index if not exists idx_leads_org_status_created
  on public.leads (org_id, status, created_at desc);

-- Transacoes: filter by org + tipo + obra_id (transacoes/route.ts GET, orcado-vs-realizado)
-- Query pattern: WHERE org_id = $1 AND tipo = $2 AND obra_id = $3
create index if not exists idx_transacoes_org_tipo_obra
  on public.transacoes (org_id, tipo, obra_id);

-- Transacoes: financial aggregation by obra (execution-repository.ts)
-- Query pattern: WHERE obra_id = $1 AND org_id = $2 SELECT tipo, valor
create index if not exists idx_transacoes_obra_org
  on public.transacoes (obra_id, org_id);

-- Aprovacoes: pending approvals by obra for portal listing
-- Query pattern: WHERE obra_id = $1 AND status = 'pendente' ORDER BY solicitado_em DESC
create index if not exists idx_aprovacoes_obra_pendente
  on public.aprovacoes_cliente (obra_id, status, solicitado_em desc)
  where status = 'pendente';

-- Roadmap actions: active actions for user dashboard (roadmap-service.ts)
-- Query pattern: WHERE org_id = $1 AND user_id = $2 AND status IN ('pending','in_progress') ORDER BY due_at
create index if not exists idx_roadmap_actions_active
  on public.roadmap_actions (org_id, user_id, status, due_at)
  where status in ('pending', 'in_progress');

-- Cronograma items: schedule queries by obra + status (cronograma/route.ts)
-- Query pattern: WHERE obra_id = $1 AND status = $2
create index if not exists idx_cronograma_itens_obra_status
  on public.cronograma_itens (obra_id, status);
