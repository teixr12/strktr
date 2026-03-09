# Auth E2E Strict Validation

## Objetivo
Eliminar a ambiguidade operacional do bloco autenticado de E2E e transformar a suíte autenticada de negócio em um gate executável fora do CI.

## Pré-requisitos
- caminho 1: os envs estritos já existem
  - `E2E_BEARER_TOKEN`
  - `E2E_OBRA_ID`
  - `E2E_MANAGER_BEARER_TOKEN`
  - `E2E_USER_BEARER_TOKEN`
  - `E2E_FOREIGN_OBRA_ID`
- caminho 2: você tem os envs-fonte para auto-prepare
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `E2E_USER_EMAIL`
  - `E2E_USER_PASSWORD`
  - `E2E_MANAGER_EMAIL`
  - `E2E_MANAGER_PASSWORD`
  - `E2E_ROLE_USER_EMAIL`
  - `E2E_ROLE_USER_PASSWORD`
  - `E2E_FOREIGN_EMAIL`
  - `E2E_FOREIGN_PASSWORD`

## Readiness
```bash
npm run ops:auth-e2e:readiness
```

## Execução estrita
### Se os envs estritos já existirem
```bash
npm run test:e2e:strict:auth
```

### Se quiser provisionar/gerar os envs automaticamente antes do teste
```bash
E2E_AUTO_PREPARE=1 npm run test:e2e:strict:auth
```

## CI oficial
- o workflow de CI já prepara a matriz autenticada antes do passo E2E
- `scripts/run-e2e-ci.mjs` agora aceita `E2E_AUTH_STRICT_REQUIRED=1`
- quando esse modo está ligado:
  1. roda `run-auth-e2e-strict.mjs`
  2. se passar, roda `run-smoke-core-http.mjs`
  3. encerra o gate estrito sem chamar Playwright no trecho de smoke

## O que é validado
1. `tests/e2e/auth-strict.spec.ts`
2. zero `skip`
3. zero `unexpected`
4. zero `failed`

## O que não entra mais neste gate
- fluxos pesados de negócio de `tests/e2e/business-flow.spec.ts`
- `tests/e2e/performance-core.spec.ts`
- `tests/e2e/smoke.spec.ts` completo
- `tests/e2e/smoke-core.spec.ts`
- motivo:
  - essa suíte é mais lenta e não valida a correção do role matrix/auth strict
  - o fluxo pesado de negócio também estava consumindo a janela inteira do job `quality`
  - o `smoke-core` em Playwright continuava queimando budget sem adicionar cobertura relevante de auth/tenant
  - o gate estrito agora prova só o que ele precisa provar: auth, tenant isolation e smoke mínimo por HTTP

## Comportamento
- `pass`: suíte autenticada rodou por completo e sem skip
- `fail`: faltam envs, o auto-prepare falhou ou a suíte falhou

## Saída
- readiness: `docs/reports/auth-e2e-readiness-<timestamp>.md`
- execução estrita: `docs/reports/auth-e2e-strict-<timestamp>.md`
- smoke mínimo HTTP: `docs/reports/smoke-core-http-<timestamp>.md`
