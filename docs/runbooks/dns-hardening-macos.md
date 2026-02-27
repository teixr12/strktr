# DNS Hardening (macOS) + Fallback Cloud-First

## Objetivo
Reduzir instabilidade local de DNS e garantir operação contínua de release mesmo quando o terminal local falhar.

## 1) Diagnóstico rápido
Execute:

```bash
scutil --dns | sed -n '1,120p'
for u in https://api.github.com https://api.vercel.com https://strktr.vercel.app/api/v1/health/ops; do
  echo "--- $u"
  curl -I -m 10 -sS "$u" | head -n 2
done
```

Se houver `Could not resolve host`, aplique hardening abaixo.

## 2) Hardening DNS na interface ativa
Identifique o nome da interface de rede:

```bash
networksetup -listallnetworkservices
```

Defina DNS manual (exemplo para interface `Wi-Fi`):

```bash
sudo networksetup -setdnsservers "Wi-Fi" 1.1.1.1 8.8.8.8 192.168.15.1
```

Verifique:

```bash
networksetup -getdnsservers "Wi-Fi"
```

## 3) Renovar rede e limpar cache
```bash
sudo ipconfig set en1 DHCP
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder
```

> Ajuste `en1` para sua interface real, se necessário.

## 4) Validação pós-hardening
```bash
for u in https://api.github.com https://api.vercel.com https://strktr.vercel.app/api/v1/health/ops; do
  echo "--- $u"
  curl -I -m 10 -sS "$u" | head -n 2
done
```

## 5) Se DNS local falhar durante release
Use modo cloud-first sem bloquear produção:
1. Merge pelo GitHub web.
2. Acompanhar workflows `CI` e `Release Ops`.
3. Ajustar flags pelo dashboard Vercel.
4. Confirmar:
   - `/api/v1/health/ops`
   - `/api/v1/ops/release`
5. Smoke manual no navegador.

## 6) Rollback operacional
1. Desligar flag do módulo afetado (`NEXT_PUBLIC_FF_*`).
2. Redeploy.
3. Se necessário, rollback de deployment no Vercel.
4. Banco: apenas migration compensatória, nunca rollback destrutivo.
