# 0091 — Public API token request block preview V1

## Status
Accepted

## Context

`publicApiV1` ja possui governanca interna de clientes, tokens, uso historico e quota efetiva por token. Faltava uma forma segura de responder "esta chamada seria bloqueada agora?" sem gravar evento real e sem abrir a API publica de verdade.

## Decision

Adicionar um endpoint interno e gated:

- `POST /api/v1/public-api/clients/:id/tokens/:tokenId/block-preview`

O endpoint:

- reutiliza o uso real do token no periodo observado
- calcula a quota efetiva do token
- retorna o estado atual de quota
- projeta o estado apos `call_count` chamadas hipoteticas
- nao grava evento de uso

Tambem foi corrigido o resumo de uso do token para calcular quota sobre o conjunto completo de eventos do periodo, limitando apenas a lista exibida de eventos recentes.

## Consequences

Positivas:

- preview operacional claro para blast radius por token
- nenhuma persistencia fake
- nenhuma abertura publica real
- melhora a corretude do resumo de uso por token

Negativas:

- mais uma superficie interna para manter
- consultas de uso do token deixam de limitar o conjunto usado no calculo do resumo

## Rollback

- manter `publicApiV1` desligado ou fora do canario
- remover a rota de preview e o bloco de UI se a simulacao nao agregar valor
