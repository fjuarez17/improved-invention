# Despliegue público del oráculo e IPFS

Este runbook deja preparados los dos bloqueos externos que faltan para una demo
pública completa: hosting 24/7 del oráculo y pinning IPFS real. Ningún secreto
debe entrar al repositorio ni al video.

## 1. Oráculo 24/7

El paquete ya está preparado en `oracle/`:

- `oracle/Dockerfile`
- `oracle/render.yaml`
- health check: `GET /health`

### Validación local ya verificada

```bash
cd oracle
docker build -t calchai-oracle:local .
docker run -d --name calchai-oracle-test \
  -p 127.0.0.1:8788:8000 \
  -e ORACLE_REQUIRE_SIGNATURE=true \
  -e ORACLE_STATE_FILE=/tmp/oracle-state.json \
  calchai-oracle:local
curl http://127.0.0.1:8788/health
```

Sin `ORACLE_PRIVATE_KEY`, `/health` debe responder `200` con
`oracleConfigured: false` y `onChainOracle` leído de la red si el RPC responde.
Con la clave configurada debe mostrar la dirección del oráculo y su saldo.

### Render

1. En https://dashboard.render.com, elegir **New → Blueprint**.
2. Conectar `fjuarez17/improved-invention` y dejar que Render lea
   `oracle/render.yaml`.
3. Configurar en el panel el secreto `ORACLE_PRIVATE_KEY` de la wallet del
   oráculo (`0x9aBB...e8e3` en testnet). No pegar la clave en código ni chat.
4. Añadir el origen público de la dApp a `ORACLE_ALLOWED_ORIGINS` si cambia:
   `https://dist-zyczpjct.devinapps.com`.
5. Comprobar `https://<servicio>.onrender.com/health`:
   - `oracleConfigured: true`
   - `rpcConnected: true`
   - `onChainOracle` igual a la wallet del oráculo
   - `gasBalanceMon` mayor que cero
6. Antes de la demo, llamar `/health` una vez para despertar el plan free si el
   servicio estuvo inactivo.

## 2. Conectar la dApp al oráculo público

No hace falta redeployar la dApp:

```text
https://dist-zyczpjct.devinapps.com/?oracle=https://<url-del-oraculo>
```

La URL se guarda en `localStorage`. Para volver al local usar
`?oracle=http://localhost:8787`.

## 3. IPFS real

`pin_trace()` usa, en este orden:

1. `PINATA_JWT` → sube a Pinata;
2. `IPFS_API_URL` → usa un nodo/API IPFS;
3. ninguna → fallback determinista marcado con `cidPinned: false`.

Para demostrar IPFS real, configurar una de las dos opciones como secreto del
hosting:

```text
PINATA_JWT=<jwt de Pinata>
# o
IPFS_API_URL=<endpoint IPFS compatible con /api/v0/add>
```

Después verificar una reclamación nueva y exigir que la respuesta devuelva:

```json
{"cidPinned": true, "cidUrl": "https://..."}
```

Mientras no exista esa configuración, decir “CID determinista de respaldo”, no
“trace publicada en IPFS”.

## 4. Checklist antes de presentar

- [ ] Repo público y `main` actualizado.
- [ ] `/health` del oráculo responde 200.
- [ ] `oracleConfigured: true` y saldo MON suficiente.
- [ ] `ORACLE_ALLOWED_ORIGINS` contiene la dApp usada en la demo.
- [ ] Una recompensa verificada ensayada desde la dApp.
- [ ] Un rechazo ensayado: respuesta incorrecta, duplicado o cooldown.
- [ ] `cidPinned` explicado con honestidad.
- [ ] Ninguna private key, seed phrase ni `.env` visible en pantalla.

## 5. Próximos bloques de producto

Estos requieren diseño y nuevos contratos; no deben presentarse como ya hechos:

- acceso pagado a trazas;
- reparto automático al productor;
- quema o captura de tesorería;
- staking y slashing de validadores;
- múltiples oráculos o multi-firma;
- problemas rotativos o generados por usuario.
