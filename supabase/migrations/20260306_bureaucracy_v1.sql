create table if not exists public.burocracia_itens (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  obra_id uuid null references public.obras(id) on delete set null,
  projeto_id uuid null references public.projetos(id) on delete set null,
  titulo text not null,
  categoria text not null default 'prefeitura' check (categoria in ('prefeitura', 'condominio', 'judicial', 'extrajudicial', 'cartorio', 'documentacao', 'licenciamento', 'outro')),
  status text not null default 'pending' check (status in ('draft', 'pending', 'in_review', 'waiting_external', 'scheduled', 'resolved', 'archived')),
  prioridade text not null default 'medium' check (prioridade in ('low', 'medium', 'high', 'critical')),
  processo_codigo text null,
  orgao_nome text null,
  responsavel_nome text null,
  responsavel_email text null,
  proxima_acao text null,
  proxima_checagem_em date null,
  reuniao_em timestamptz null,
  link_externo text null,
  descricao text null,
  ultima_atualizacao_em timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_burocracia_itens_org_updated_at
  on public.burocracia_itens (org_id, updated_at desc);
create index if not exists idx_burocracia_itens_org_status
  on public.burocracia_itens (org_id, status, prioridade);
create index if not exists idx_burocracia_itens_org_check_date
  on public.burocracia_itens (org_id, proxima_checagem_em);
create index if not exists idx_burocracia_itens_org_obra
  on public.burocracia_itens (org_id, obra_id);
create index if not exists idx_burocracia_itens_org_projeto
  on public.burocracia_itens (org_id, projeto_id);

alter table public.burocracia_itens enable row level security;

drop policy if exists burocracia_itens_org_read on public.burocracia_itens;
create policy burocracia_itens_org_read on public.burocracia_itens
  for select using (org_id = public.current_org_id());

drop policy if exists burocracia_itens_org_write on public.burocracia_itens;
create policy burocracia_itens_org_write on public.burocracia_itens
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
