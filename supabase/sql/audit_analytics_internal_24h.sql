with target_events as (
  select unnest(array[
    'PageViewed',
    'core_create',
    'core_move',
    'portal_approval_decision',
    'ChecklistItemToggled'
  ]) as event_type
),
counts as (
  select e.event_type, count(*)::bigint as internal_total_24h
  from public.eventos_produto e
  where e.created_at >= now() - interval '24 hours'
    and e.event_type in (select event_type from target_events)
  group by e.event_type
)
select
  t.event_type,
  coalesce(c.internal_total_24h, 0)::bigint as internal_total_24h
from target_events t
left join counts c using (event_type)
order by t.event_type;
