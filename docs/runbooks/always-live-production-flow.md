# Always-Live Production Flow (GitHub -> Vercel auto, Supabase seguro)

## Objetivo
Permitir release contínuo para usuários finais sem quebrar produção:
- App: deploy automático no merge da `main`.
- Banco: migrations apenas por workflow manual com aprovação.
- Rollback rápido por feature flag.

## Regras obrigatórias
1. Nunca dar push direto em `main`.
2. Toda mudança entra por PR com checks obrigatórios.
3. Mudança de schema somente por `supabase/migrations/*.sql`.
4. Não usar dashboard do Supabase para mudança estrutural.
5. Toda feature nova nasce com flag e fallback.

## Fluxo operacional padrão (diário)
1. Criar branch curta `codex/<tema>`.
2. Abrir PR com escopo pequeno.
3. Validar checks:
   - `quality`
   - `pr-governance`
   - `secrets-scan`
   - `Vercel`
4. Merge em `main`.
5. Aguardar workflow `Release Ops` concluir.
6. Monitorar 30-60 min:
   - `https://strktr.vercel.app/api/v1/health/ops`
   - Sentry (erros client/server)
   - rotas críticas da release

## Fluxo de migration Supabase (quando necessário)
1. Criar migration aditiva em `supabase/migrations/*.sql`.
2. Executar workflow `Supabase Migrations`:
   - `target_environment=staging`
   - `dry_run=true`
   - depois `dry_run=false`
3. Repetir para produção:
   - `target_environment=production`
   - `dry_run=true`
   - `dry_run=false` (requer aprovação no environment `supabase-production`)
4. Rodar auditorias antes/depois (workflow já executa):
   - migrations aplicadas
   - tenancy/RLS
   - `org_id` nulos

## Rollback padrão
1. Desligar flag do módulo afetado.
2. Redeploy Vercel.
3. Se não resolver, rollback de deployment.
4. Banco: usar migration compensatória (sem rollback destrutivo).

## Proibido no ciclo contínuo
- `DROP TABLE`
- `DROP COLUMN`
- mudanças irreversíveis sem janela de validação

## Evidência mínima por release
- Link do PR
- SHA merged
- Resultado do `Release Ops`
- 3 screenshots/sinais de saúde (health + Sentry + fluxo crítico)
