-- STRKTR Wave: PDF storage + approval versioning + SLA alerts
-- Stage: expand
-- Additive and idempotent migration (no destructive changes).

alter table if exists public.aprovacoes_cliente
  add column if not exists approval_version int not null default 1;

alter table if exists public.aprovacoes_cliente
  add column if not exists predecessor_aprovacao_id uuid null references public.aprovacoes_cliente(id) on delete set null;

alter table if exists public.aprovacoes_cliente
  add column if not exists sla_due_at timestamptz null;

alter table if exists public.aprovacoes_cliente
  add column if not exists sla_alert_sent_at timestamptz null;

alter table if exists public.compras
  add column if not exists approval_version int not null default 1;

alter table if exists public.compras
  add column if not exists blocked_reason text null;

alter table if exists public.orcamentos
  add column if not exists approval_version int not null default 1;

alter table if exists public.orcamentos
  add column if not exists blocked_reason text null;

create index if not exists idx_aprovacoes_cliente_org_status_version
  on public.aprovacoes_cliente (org_id, status, approval_version);

create index if not exists idx_aprovacoes_cliente_org_sla_due
  on public.aprovacoes_cliente (org_id, sla_due_at)
  where status = 'reprovado';

create index if not exists idx_compras_org_approval_version
  on public.compras (org_id, approval_version);

create index if not exists idx_orcamentos_org_approval_version
  on public.orcamentos (org_id, approval_version);

do $$
begin
  if exists (
    select 1
    from pg_namespace
    where nspname = 'storage'
  ) then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'cronograma-pdfs',
      'cronograma-pdfs',
      false,
      10485760,
      array['application/pdf']::text[]
    )
    on conflict (id) do update
      set public = excluded.public,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
  end if;
end
$$;
