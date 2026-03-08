# ADR 0059 — Bureaucracy V1

## Context
STRKTR já possui fluxo forte para portal, aprovações e notificações, mas ainda não havia um domínio próprio para controlar frentes burocráticas como prefeitura, condomínio, cartório e processos judiciais/extrajudiciais sem forçar esse trabalho em módulos errados.

## Decision
Criar `bureaucracyV1` como domínio aditivo, com:
- tabela própria `burocracia_itens`
- CRUD real em `/api/v1/burocracia*`
- página `/burocracia` atrás de flag + canário por organização
- vínculo opcional com obra e projeto
- modelo orientado a operação: status, prioridade, próxima ação, próxima checagem e reunião

## Consequences
- Não quebra portal, notificações, agenda nem aprovações existentes.
- Permite crescer automações depois sem reusar tabelas de produto incorretas.
- Mantém rollout seguro: `404-safe` quando desligado ou fora do canário.
