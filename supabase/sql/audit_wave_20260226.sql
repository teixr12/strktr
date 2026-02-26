with required_columns as (
  select * from (values
    ('aprovacoes_cliente', 'approval_version'),
    ('aprovacoes_cliente', 'predecessor_aprovacao_id'),
    ('aprovacoes_cliente', 'sla_due_at'),
    ('aprovacoes_cliente', 'sla_alert_sent_at'),
    ('compras', 'approval_version'),
    ('compras', 'blocked_reason'),
    ('orcamentos', 'approval_version'),
    ('orcamentos', 'blocked_reason')
  ) as t(table_name, column_name)
),
columns_status as (
  select
    rc.table_name,
    rc.column_name,
    exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = rc.table_name
        and c.column_name = rc.column_name
    ) as exists
  from required_columns rc
),
bucket_status as (
  select
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
  from storage.buckets
  where id = 'cronograma-pdfs'
)
select
  (select json_agg(columns_status order by table_name, column_name) from columns_status) as columns_status,
  (select json_agg(bucket_status) from bucket_status) as bucket_status;
