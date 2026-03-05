# Analytics Capture Probe Report

- GeneratedAt: 2026-03-05T08:36:07Z
- Host: https://app.posthog.com
- ProbeId: ops-probe-1772699753-14859
- ProbeCount(30m): 1
- Status: pass
- Message: evento de probe capturado no PostHog

## Raw Capture JSON
```json
{"status":"Ok"}
```

## Raw Query JSON
```json
{"cache_key":"cache_306448_64eed75c2733a67b4d521d4189c5f630014b0be1b7f2294af53392f3489196de","cache_target_age":"2026-03-05T14:36:06.955816Z","calculation_trigger":null,"clickhouse":"SELECT\n    count(*) AS `count(*)`\nFROM\n    events\nWHERE\n    and(equals(events.team_id, 306448), equals(events.event, %(hogql_val_0)s), equals(events.distinct_id, %(hogql_val_1)s), greaterOrEquals(toTimeZone(events.timestamp, %(hogql_val_2)s), minus(now64(6, %(hogql_val_3)s), toIntervalMinute(60))))\nLIMIT 101\nOFFSET 0 SETTINGS readonly=2, max_execution_time=10, max_threads=60, allow_experimental_object_type=1, max_ast_elements=4000000, max_expanded_ast_elements=4000000, max_bytes_before_external_group_by=0, allow_experimental_analyzer=1, transform_null_in=1, optimize_min_equality_disjunction_chain_length=4294967295, allow_experimental_join_condition=1, use_hive_partitioning=0","columns":["count(*)"],"error":null,"explain":null,"hasMore":false,"hogql":"SELECT\n    count(*)\nFROM\n    events\nWHERE\n    and(equals(event, 'ops_capture_probe'), equals(distinct_id, 'ops-probe-1772699753-14859'), greaterOrEquals(timestamp, minus(now(), toIntervalMinute(60))))\nLIMIT 101\nOFFSET 0","is_cached":false,"last_refresh":"2026-03-05T08:36:06.955816Z","limit":100,"metadata":null,"modifiers":{"bounceRateDurationSeconds":null,"bounceRatePageViewMode":"count_pageviews","convertToProjectTimezone":true,"customChannelTypeRules":null,"dataWarehouseEventsModifiers":null,"debug":null,"forceClickhouseDataSkippingIndexes":null,"formatCsvAllowDoubleQuotes":null,"inCohortVia":"subquery","inlineCohortCalculation":"auto","materializationMode":"legacy_null_as_null","materializedColumnsOptimizationMode":null,"optimizeJoinedFilters":false,"optimizeProjections":true,"personsArgMaxVersion":"auto","personsJoinMode":null,"personsOnEventsMode":"person_id_override_properties_on_events","propertyGroupsMode":"optimized","s3TableUseInvalidColumns":null,"sessionTableVersion":"auto","sessionsV2JoinMode":"uuid","timings":null,"useMaterializedViews":true,"usePreaggregatedIntermediateResults":null,"usePreaggregatedTableTransforms":null,"useWebAnalyticsPreAggregatedTables":null},"next_allowed_client_refresh":"2026-03-05T08:37:06.955816Z","offset":0,"query":null,"query_metadata":{"events":[],"updated_at":"2026-03-05T08:36:07.182215Z"},"query_status":null,"resolved_date_range":null,"results":[[1]],"timezone":"UTC","timings":null,"types":[["count(*)","UInt64"]]}
```
