# STRKTR Production Audit

- GeneratedAt: 2026-02-26T09:03:41Z
- HealthCheck: ok
- SupabaseMigrationsAudit: ok
- SupabaseRlsAudit: ok
- SupabaseOrgIdNullsAudit: ok

## Health Endpoint
```json
{"data":{"status":"ok","ts":"2026-02-26T09:03:34.322Z","checks":[{"name":"runtime","ok":true},{"name":"supabase_connection","ok":true}],"version":"9e2d9a5ce5c0af70da6065f1053165cdf88549be","flags":{"checklistDueDate":true,"productAnalytics":true}},"requestId":"6d50dd73-00c8-4267-a1fb-4ad0208b6281"}
```

## Applied Migrations
```json
{"message":"Failed to run sql query: ERROR:  42P01: relation \"supabase_migrations.schema_migrations\" does not exist\nLINE 2: from supabase_migrations.schema_migrations\n             ^\n"}
```

## Tenancy/RLS Audit
```json
[{"table_name":"checklist_items","rls_enabled":true,"rls_forced":false,"policy_count":3},{"table_name":"compras","rls_enabled":true,"rls_forced":false,"policy_count":3},{"table_name":"diario_obra","rls_enabled":true,"rls_forced":false,"policy_count":3},{"table_name":"equipe","rls_enabled":true,"rls_forced":false,"policy_count":2},{"table_name":"eventos_produto","rls_enabled":true,"rls_forced":false,"policy_count":2},{"table_name":"knowledgebase","rls_enabled":true,"rls_forced":false,"policy_count":2},{"table_name":"leads","rls_enabled":true,"rls_forced":false,"policy_count":3},{"table_name":"obra_checklists","rls_enabled":true,"rls_forced":false,"policy_count":3},{"table_name":"obra_etapas","rls_enabled":true,"rls_forced":false,"policy_count":3},{"table_name":"obras","rls_enabled":true,"rls_forced":false,"policy_count":3},{"table_name":"orcamento_itens","rls_enabled":true,"rls_forced":false,"policy_count":2},{"table_name":"orcamentos","rls_enabled":true,"rls_forced":false,"policy_count":2},{"table_name":"projetos","rls_enabled":true,"rls_forced":false,"policy_count":3},{"table_name":"transacoes","rls_enabled":true,"rls_forced":false,"policy_count":3},{"table_name":"visitas","rls_enabled":true,"rls_forced":false,"policy_count":3}]
```

## org_id Null Audit
```json
[{"table_name":"checklist_items","org_id_nulls":0},{"table_name":"compras","org_id_nulls":0},{"table_name":"diario_obra","org_id_nulls":0},{"table_name":"eventos_produto","org_id_nulls":0},{"table_name":"leads","org_id_nulls":0},{"table_name":"obra_checklists","org_id_nulls":0},{"table_name":"obra_etapas","org_id_nulls":0},{"table_name":"obras","org_id_nulls":0},{"table_name":"orcamentos","org_id_nulls":0},{"table_name":"projetos","org_id_nulls":0},{"table_name":"transacoes","org_id_nulls":0},{"table_name":"visitas","org_id_nulls":0}]
```
