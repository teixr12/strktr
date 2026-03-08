# Auth E2E Strict Validation

## Objetivo
Eliminar a ambiguidade operacional do bloco autenticado de E2E e transformar a suíte de negócio/performance em um gate executável fora do CI.

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
  2. se passar, roda só `smoke.spec.ts` no runner geral para evitar duplicação do bloco autenticado

## O que é validado
1. `tests/e2e/business-flow.spec.ts`
2. `tests/e2e/performance-core.spec.ts`
3. zero `skip`
4. zero `unexpected`
5. zero `failed`

## Comportamento
- `pass`: suíte autenticada rodou por completo e sem skip
- `fail`: faltam envs, o auto-prepare falhou ou a suíte falhou

## Saída
- readiness: `docs/reports/auth-e2e-readiness-<timestamp>.md`
- execução estrita: `docs/reports/auth-e2e-strict-<timestamp>.md`
