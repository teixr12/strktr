select
  'auth' as source,
  version::text as migration_id,
  null::timestamp as executed_at,
  null::text as name
from auth.schema_migrations
union all
select
  'realtime' as source,
  version::text as migration_id,
  inserted_at as executed_at,
  null::text as name
from realtime.schema_migrations
union all
select
  'storage' as source,
  id::text as migration_id,
  executed_at as executed_at,
  name
from storage.migrations
order by source, migration_id desc;
