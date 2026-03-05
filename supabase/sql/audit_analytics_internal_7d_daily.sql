with target_events as (
  select unnest(array[
    'PageViewed',
    'core_create',
    'core_move',
    'portal_approval_decision',
    'ChecklistItemToggled'
  ]) as event_type
),
days as (
  select ((now() at time zone 'UTC')::date - gs.day_offset) as day
  from generate_series(0, 6) as gs(day_offset)
),
counts as (
  select
    (e.created_at at time zone 'UTC')::date as day,
    e.event_type,
    count(*)::bigint as internal_total_day
  from public.eventos_produto e
  where e.created_at >= ((now() at time zone 'UTC')::date - 6)
    and e.event_type in (select event_type from target_events)
    and (
      (e.event_type = 'PageViewed' and e.user_id is not null)
      or (
        e.event_type = 'ChecklistItemToggled'
        and coalesce(e.payload ->> 'source', '') = ''
      )
      or (
        e.event_type = 'portal_approval_decision'
        and coalesce(e.payload ->> 'source', '') = ''
      )
      or e.event_type in ('core_create', 'core_move')
    )
  group by 1, 2
)
select
  d.day,
  t.event_type,
  coalesce(c.internal_total_day, 0)::bigint as internal_total_day
from days d
cross join target_events t
left join counts c
  on c.day = d.day
 and c.event_type = t.event_type
order by d.day, t.event_type;
