alter table public.fornecedores
  add column if not exists supplier_intelligence jsonb null;

comment on column public.fornecedores.supplier_intelligence is
  'Materialized supplier intelligence read model with linkedBureaucracyItems and metrics.';
