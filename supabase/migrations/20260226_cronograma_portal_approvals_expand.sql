-- STRKTR Wave: cronograma + portal cliente + aprovacoes + pdf export
-- Stage: expand
-- Non-breaking, additive only.

create table if not exists public.cronograma_obras (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  obra_id uuid not null references public.obras(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null default 'Cronograma principal',
  calendario jsonb not null default '{"dias_uteis":[1,2,3,4,5]}'::jsonb,
  data_inicio_planejada date null,
  data_fim_planejada date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (obra_id)
);

create table if not exists public.cronograma_itens (
  id uuid primary key default gen_random_uuid(),
  cronograma_id uuid not null references public.cronograma_obras(id) on delete cascade,
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  obra_id uuid not null references public.obras(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  descricao text null,
  tipo text not null default 'tarefa',
  status text not null default 'pendente',
  empresa_responsavel text null,
  responsavel text null,
  data_inicio_planejada date null,
  data_fim_planejada date null,
  duracao_dias int not null default 1,
  data_inicio_real date null,
  data_fim_real date null,
  progresso int not null default 0,
  atraso_dias int not null default 0,
  ordem int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cronograma_dependencias (
  id uuid primary key default gen_random_uuid(),
  cronograma_id uuid not null references public.cronograma_obras(id) on delete cascade,
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  predecessor_item_id uuid not null references public.cronograma_itens(id) on delete cascade,
  successor_item_id uuid not null references public.cronograma_itens(id) on delete cascade,
  tipo text not null default 'FS',
  lag_dias int not null default 0,
  created_at timestamptz not null default now(),
  unique (predecessor_item_id, successor_item_id)
);

create table if not exists public.cronograma_baselines (
  id uuid primary key default gen_random_uuid(),
  cronograma_id uuid not null references public.cronograma_obras(id) on delete cascade,
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  versao int not null default 1,
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.portal_clientes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  obra_id uuid not null references public.obras(id) on delete cascade,
  nome text not null,
  email text not null,
  telefone text null,
  ativo boolean not null default true,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  obra_id uuid not null references public.obras(id) on delete cascade,
  portal_cliente_id uuid not null references public.portal_clientes(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz null
);

create table if not exists public.aprovacoes_cliente (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  obra_id uuid not null references public.obras(id) on delete cascade,
  tipo text not null,
  compra_id uuid null references public.compras(id) on delete set null,
  orcamento_id uuid null references public.orcamentos(id) on delete set null,
  status text not null default 'pendente',
  solicitado_por uuid not null references auth.users(id) on delete cascade,
  solicitado_em timestamptz not null default now(),
  decidido_por_portal_cliente_id uuid null references public.portal_clientes(id) on delete set null,
  decisao_comentario text null,
  decidido_em timestamptz null
);

create table if not exists public.portal_comentarios (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  obra_id uuid not null references public.obras(id) on delete cascade,
  portal_cliente_id uuid null references public.portal_clientes(id) on delete set null,
  user_id uuid null references auth.users(id) on delete set null,
  aprovacao_id uuid null references public.aprovacoes_cliente(id) on delete set null,
  origem text not null default 'cliente',
  mensagem text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.cronograma_pdf_exports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  obra_id uuid not null references public.obras(id) on delete cascade,
  cronograma_id uuid null references public.cronograma_obras(id) on delete set null,
  gerado_por uuid null references auth.users(id) on delete set null,
  file_name text not null,
  file_size_bytes int not null default 0,
  storage_path text null,
  created_at timestamptz not null default now()
);

alter table if exists public.obra_etapas
  add column if not exists cronograma_item_id uuid null references public.cronograma_itens(id) on delete set null;

alter table if exists public.compras
  add column if not exists aprovacao_cliente_id uuid null references public.aprovacoes_cliente(id) on delete set null;
alter table if exists public.compras
  add column if not exists exige_aprovacao_cliente boolean not null default false;

alter table if exists public.orcamentos
  add column if not exists aprovacao_cliente_id uuid null references public.aprovacoes_cliente(id) on delete set null;
alter table if exists public.orcamentos
  add column if not exists exige_aprovacao_cliente boolean not null default false;

create index if not exists idx_cronograma_obras_org_obra
  on public.cronograma_obras (org_id, obra_id);
create index if not exists idx_cronograma_itens_org_obra
  on public.cronograma_itens (org_id, obra_id, ordem);
create index if not exists idx_cronograma_itens_org_status
  on public.cronograma_itens (org_id, status);
create index if not exists idx_cronograma_itens_datas
  on public.cronograma_itens (obra_id, data_inicio_planejada, data_fim_planejada);
create index if not exists idx_cronograma_dependencias_org
  on public.cronograma_dependencias (org_id, cronograma_id);
create index if not exists idx_portal_sessions_expires_at
  on public.portal_sessions (expires_at);
create index if not exists idx_portal_sessions_org_obra
  on public.portal_sessions (org_id, obra_id);
create index if not exists idx_aprovacoes_org_status
  on public.aprovacoes_cliente (org_id, status, solicitado_em desc);
create index if not exists idx_portal_comentarios_org_obra
  on public.portal_comentarios (org_id, obra_id, created_at desc);
create index if not exists idx_pdf_exports_org_obra
  on public.cronograma_pdf_exports (org_id, obra_id, created_at desc);

alter table public.cronograma_obras enable row level security;
alter table public.cronograma_itens enable row level security;
alter table public.cronograma_dependencias enable row level security;
alter table public.cronograma_baselines enable row level security;
alter table public.portal_clientes enable row level security;
alter table public.portal_sessions enable row level security;
alter table public.aprovacoes_cliente enable row level security;
alter table public.portal_comentarios enable row level security;
alter table public.cronograma_pdf_exports enable row level security;

drop policy if exists cronograma_obras_org_read on public.cronograma_obras;
drop policy if exists cronograma_obras_org_write on public.cronograma_obras;
create policy cronograma_obras_org_read on public.cronograma_obras
for select using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy cronograma_obras_org_write on public.cronograma_obras
for all
using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));

drop policy if exists cronograma_itens_org_read on public.cronograma_itens;
drop policy if exists cronograma_itens_org_write on public.cronograma_itens;
create policy cronograma_itens_org_read on public.cronograma_itens
for select using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy cronograma_itens_org_write on public.cronograma_itens
for all
using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));

drop policy if exists cronograma_dependencias_org_read on public.cronograma_dependencias;
drop policy if exists cronograma_dependencias_org_write on public.cronograma_dependencias;
create policy cronograma_dependencias_org_read on public.cronograma_dependencias
for select using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy cronograma_dependencias_org_write on public.cronograma_dependencias
for all
using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));

drop policy if exists cronograma_baselines_org_read on public.cronograma_baselines;
drop policy if exists cronograma_baselines_org_write on public.cronograma_baselines;
create policy cronograma_baselines_org_read on public.cronograma_baselines
for select using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy cronograma_baselines_org_write on public.cronograma_baselines
for all
using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));

drop policy if exists portal_clientes_org_read on public.portal_clientes;
drop policy if exists portal_clientes_org_write on public.portal_clientes;
create policy portal_clientes_org_read on public.portal_clientes
for select using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy portal_clientes_org_write on public.portal_clientes
for all
using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));

drop policy if exists portal_sessions_org_read on public.portal_sessions;
drop policy if exists portal_sessions_org_write on public.portal_sessions;
create policy portal_sessions_org_read on public.portal_sessions
for select using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy portal_sessions_org_write on public.portal_sessions
for all
using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));

drop policy if exists aprovacoes_cliente_org_read on public.aprovacoes_cliente;
drop policy if exists aprovacoes_cliente_org_write on public.aprovacoes_cliente;
create policy aprovacoes_cliente_org_read on public.aprovacoes_cliente
for select using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy aprovacoes_cliente_org_write on public.aprovacoes_cliente
for all
using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));

drop policy if exists portal_comentarios_org_read on public.portal_comentarios;
drop policy if exists portal_comentarios_org_write on public.portal_comentarios;
create policy portal_comentarios_org_read on public.portal_comentarios
for select using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy portal_comentarios_org_write on public.portal_comentarios
for all
using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));

drop policy if exists cronograma_pdf_exports_org_read on public.cronograma_pdf_exports;
drop policy if exists cronograma_pdf_exports_org_write on public.cronograma_pdf_exports;
create policy cronograma_pdf_exports_org_read on public.cronograma_pdf_exports
for select using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy cronograma_pdf_exports_org_write on public.cronograma_pdf_exports
for all
using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));
