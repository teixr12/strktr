# Release Trains Manifest

## Objective
- Turn the current local branch into mergeable release trains instead of one oversized PR.
- Keep every new module disabled in production until its own rollout window opens.
- Make the train cut visible in code and in ops docs.

## Train A — Foundation
- Goal:
  - ship the control plane, train metadata, health/ops extensions, shell wiring and gates
  - keep all new module flags `OFF`
- Scope:
  - feature flags and org canary helpers
  - `/api/v1/health/ops`
  - `/api/v1/ops/program`
  - program status metadata
  - shell/nav/command palette wiring
  - smoke and UX/perf governance coverage
  - branch hygiene for generated artifacts
- Must not include:
  - product-domain write behavior that changes live user workflows
  - generated reports
  - local tool artifacts

## Train B — Pod B Foundations
- Goal:
  - land Pod B surfaces and migrations with everything still `OFF`
- Scope:
  - `portalAdminV2`
  - `obraIntelligenceV1`
  - `financeDepthV1`
  - `supplierManagementV1`
  - `bureaucracyV1`
  - `emailTriageV1`
- Rules:
  - additive migrations only
  - `404-safe` when feature/org rollout is off
  - no production activation in the merge PR

## Train C — Pod C Foundations
- Goal:
  - land regulated/platform foundations with production writes blocked
- Scope:
  - `billingV1`
  - `referralV1`
  - `publicApiV1`
  - `integrationsHubV1`
  - `superAdminV1`
  - `agentReadyV1`
  - `bigDataV1`
  - `openBankingV1`
- Rules:
  - compliance gate stays active
  - write remains blocked in production unless explicitly opened later
  - no public/general release in the merge PR

## Merge Order
1. Close the active production rollout of `financeReceipts`.
2. Merge `Train A`.
3. Deploy `Train A` with all new module flags `OFF`.
4. Merge `Train B`.
5. Deploy `Train B` with all new module flags `OFF`.
6. Merge `Train C`.
7. Deploy `Train C` with all new module flags `OFF`.
8. Promote modules one at a time using allowlist → `25%` → `100%`.
