# Bureaucracy V1 Rollout Validation

- GeneratedAt: 2026-03-20T11:11:18.991Z
- BaseUrl: http://127.0.0.1:3000
- ExpectEnabled: auto
- HealthStatus: 200
- HealthFlagBureaucracyV1: false
- HealthBureaucracyV1CanaryPresent: true
- HealthBureaucracyV1CanaryPercent: 0
- HealthBureaucracyV1AllowlistCount: 0
- ForeignOrgExpectedBehavior: expect 404 before percentage rollout

## Health Payload
```json
{
  "data": {
    "status": "ok",
    "ts": "2026-03-20T11:11:19.397Z",
    "checks": [
      {
        "name": "runtime",
        "ok": true
      },
      {
        "name": "supabase_connection",
        "ok": true
      },
      {
        "name": "analytics_external_config",
        "ok": true
      }
    ],
    "version": "local",
    "rollout": {
      "wave2Canary": {
        "configured": false,
        "percent": 0,
        "allowlistCount": 0,
        "source": "wave2"
      },
      "addressHqCanary": {
        "configured": false,
        "percent": 0,
        "allowlistCount": 0,
        "source": "wave2"
      },
      "financeReceiptsCanary": {
        "configured": false,
        "percent": 0,
        "allowlistCount": 0,
        "source": "financeReceipts"
      },
      "financeReceiptAiCanary": {
        "configured": false,
        "percent": 0,
        "allowlistCount": 0,
        "source": "financeReceiptAi"
      },
      "bureaucracyV1Canary": {
        "configured": false,
        "percent": 0,
        "allowlistCount": 0,
        "source": "bureaucracyV1"
      },
      "cronogramaUxV2Canary": {
        "configured": false,
        "percent": 0,
        "allowlistCount": 0,
        "source": "cronogramaUxV2"
      },
      "docsWorkspaceCanary": {
        "configured": false,
        "percent": 0,
        "allowlistCount": 0,
        "source": "docsWorkspace"
      }
    },
    "flags": {
      "uiTailadminV1": true,
      "uiV2Obras": true,
      "uiV2Leads": true,
      "uiV2Dashboard": true,
      "uiV2Financeiro": true,
      "uiV2Comercial": true,
      "uiV2Compras": true,
      "uiV2Projetos": true,
      "uiV2Orcamentos": true,
      "uiV2Equipe": true,
      "uiV2Agenda": true,
      "uiV2Knowledgebase": true,
      "uiV2Configuracoes": true,
      "uiV2Perfil": true,
      "uiV2ObraTabs": true,
      "profileAvatarV2": true,
      "navCountsV2": true,
      "leadsProgressV2": true,
      "orcamentoPdfV2": true,
      "uiPaginationV1": true,
      "tableVirtualization": false,
      "checklistDueDate": false,
      "productAnalytics": false,
      "analyticsExternalV1": false,
      "analyticsExternalReady": true,
      "portalAdminV1": false,
      "obraKpiV1": false,
      "obraAlertsV1": false,
      "sopBuilderV1": false,
      "generalTasksV1": false,
      "taskAssignV1": false,
      "mobileUxV1": false,
      "obraWeatherV1": false,
      "obraMapV1": false,
      "obraLogisticsV1": false,
      "obraAddressUxV2": false,
      "obraHqRoutingV1": false,
      "obraWeatherAlertsV1": false,
      "constructionDocs": false,
      "cronogramaEngine": false,
      "cronogramaViewsV1": false,
      "cronogramaPdf": false,
      "cronogramaUxV2": false,
      "docsWorkspaceV1": false,
      "financeReceiptsV1": false,
      "financeReceiptAiV1": false,
      "bureaucracyV1": false,
      "clientPortal": false,
      "approvalGate": false,
      "architectAgenda": false,
      "personalRoadmap": true,
      "semiAutomation": true,
      "behaviorPrompts": true
    }
  },
  "meta": {
    "contractVersion": "v1"
  },
  "requestId": "3d491bd5-07cc-4d4b-b0e4-34bcf47acb6c"
}
```

- BurocraciaListStatus: 404
- ForeignBurocraciaListStatus: n/a
- Status: skip
- Reason: bureaucracyV1 hidden for org/token used

## Burocracia List Payload
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Recurso não encontrado"
  },
  "requestId": "16f92d60-efa5-4426-8167-144a83307eb2"
}
```
