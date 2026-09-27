# Guion de demo para jueces — CalchAI / $COGN

Duración objetivo: 6 minutos. Todo lo que aparece aquí está ejecutado y verificado;
lo que todavía no lo está aparece marcado como **pendiente**.

## 0. Antes de subir al escenario (10 min antes)

| Comprobación | Comando / acción | Resultado esperado |
| --- | --- | --- |
| dApp viva | abrir https://dist-zyczpjct.devinapps.com | dashboard con supply y vesting |
| Oráculo despierto | `curl <URL_ORACULO>/health` | JSON con `gasBalanceMon` > 0 |
| Gas del oráculo | mismo `/health` | si está a 0, faucet antes de empezar |
| Traza nueva | tener un texto de razonamiento sin usar | un CID ya recompensado da HTTP 409 |
| Agente BNB | `bag dev` en `bnb-agent/app/agent` | `curl localhost:9000/ping` → `HEALTHY` |

## 1. El problema (40 s)

Los laboratorios de IA compran datos de razonamiento humano. Hoy esos datos se
compran a granel, sin trazabilidad y sin que el que razona cobre. CalchAI convierte
cada traza de razonamiento en un activo direccionable y pagado en el momento.

## 2. El token no es especulación, es contabilidad (60 s)

Abre el explorer del token:
https://testnet.monadexplorer.com/address/0x3721E5c3162FEA106ddC42baBAcEF09664EF625F

Puntos que debe oír un VC, en este orden:

1. **Hard cap de 1.000M** — `MAX_SUPPLY` es `constant`, no hay función que lo suba.
2. **Cubeta de minería separada de 400M** — `totalMined` se lleva aparte del
   supply: quemar tokens **no** reabre emisión. Es el error clásico de los
   protocolos "deflacionarios" y aquí está cerrado.
3. **El fundador no puede acuñar** — `mintCognitiveReward` es `onlyOracle`. Ni el
   owner puede emitir recompensas.
4. **Un razonamiento se paga una sola vez** — `rewardedReasoning[cid]` rechaza
   CIDs repetidos on-chain.
5. **Cortafuegos** — `maxRewardPerMint` limita el daño si el backend se ve
   comprometido.
6. **Ownership en dos pasos** — `Ownable2Step`, ya transferido a la wallet del
   equipo (`0x55D9…0847`), verificable en el explorer.

Contratos verificados (código fuente legible por cualquiera):
- token: https://testnet.monadexplorer.com/contracts/full_match/10143/0x3721E5c3162FEA106ddC42baBAcEF09664EF625F/
- vesting: https://testnet.monadexplorer.com/contracts/full_match/10143/0xe5b63EE0BF037a0535E7f13a406019b3b7D5DF9A/

## 3. Vesting: por qué el equipo no puede hacer dump (40 s)

En la pestaña de vesting de la dApp se ven los calendarios reales, no una tabla de
PowerPoint: tesorería (5% TGE, cliff 3m, lineal 36m), equipo (0% TGE, cliff 12m,
lineal 48m), inversores (0% TGE, cliff 6m, lineal 24m), airdrop (100% TGE).
Float día 1 = 110M (11%). El contrato es irrevocable: ni el owner puede retirar
tokens de un calendario ya creado.

## 4. Demo en vivo: razonar → cobrar (90 s)

1. En la dApp, pega una traza de razonamiento nueva y pulsa evaluar.
2. El oráculo puntúa (determinista), calcula el CID y firma `mintCognitiveReward`.
3. Abre la tx en el explorer y **señala el campo `reasoningCid` del evento**:
   ese es el recibo criptográfico que une el pago con el dato producido.

Última tx de referencia por si falla la red:
https://testnet.monadexplorer.com/tx/0x975b63632261999d6b6d08558685b3fcbae6db558590f6df113b113ba282eba2

Si un juez pregunta "¿y si el usuario miente?": el oráculo aplica cooldown por
wallet, presupuesto diario de emisión y límite de tamaño; el CID duplicado se
rechaza en el contrato, no en el servidor.

## 5. El segundo mercado: el agente vendedor en BNB Chain (90 s)

El mismo evaluador se vende como agente autónomo en BSC testnet
(BNB Agent Studio, ERC-8004 de identidad y ERC-8183 de escrow). Esto responde a la
pregunta de VC "¿quién compra esto?": otro agente puede contratar la evaluación y
pagarla en escrow, sin humano en medio.

Demostración local (ejecutada, salidas reales):

```bash
curl -s localhost:9000/.well-known/agent-card.json
```
Devuelve la tarjeta A2A con dos habilidades: `negotiate` y `notify_funded`.

```bash
# negotiate → cotización firmada por la wallet del agente
```
Respuesta real (recortada):

```json
{
  "negotiation_hash": "0x4692f53af4563ae44e85df83329d99746c5205be45c4010728e3f22b769b884f",
  "provider_sig": "0xdf9a5548...e541951b",
  "chain_id": 97,
  "verifying_contract": "0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE",
  "response": { "accepted": true, "estimated_completion_seconds": 600 }
}
```

El comprador ancla esa cotización firmada con `createJob` + `fund`, avisa con
`notify_funded`, y el agente entrega. El precio sale de `studio.toml` y lo firma
código fijo: **el LLM nunca está en la ruta del precio ni de la firma**.

Evaluación (rail x402, gratis) sobre una traza de ejemplo:

```json
{
  "status": "evaluated",
  "score": 100,
  "breakdown": { "depth": 50, "structure": 30, "conclusion": 20 },
  "reasoningCid": "bafyce0fe2d779b67787f72b8a509ea8f1f257e4f813c79c22",
  "rewardEligible": true
}
```

**El remate**: esa misma traza pasada por el oráculo de Monad da el mismo CID y la
misma nota. Verificado sobre 200 trazas aleatorias, 0 discrepancias. Es decir: una
evaluación comprada en BNB Chain es liquidable como recompensa $COGN en Monad,
porque ambos lados son código determinista, no criterio de un modelo. El LLM sólo
redacta el feedback cualitativo; si el modelo cae, la nota y el CID no cambian.

## 6. Cierre (30 s)

- Lo que existe hoy: contratos verificados en Monad, vesting activo, oráculo con
  límites, dApp pública, agente vendedor con identidad on-chain en BSC testnet.
- Lo que falta y lo sabemos: pinning IPFS real (hoy el CID es determinista pero no
  se publica en IPFS), Safe multisig en mainnet, autenticación por firma del
  usuario en el oráculo, y el evaluador heurístico sustituido por un modelo
  entrenado con las propias trazas — que es exactamente el volante de inercia del
  negocio.

## Preguntas difíciles y respuestas honestas

| Pregunta | Respuesta |
| --- | --- |
| ¿Quién paga por esto? | Laboratorios de IA que hoy compran datos de razonamiento sin procedencia; el agente de BNB demuestra el canal de compra máquina-a-máquina. |
| ¿Qué impide farmear el airdrop? | Cooldown por wallet, presupuesto diario, límite de tamaño y unicidad de CID on-chain. No es suficiente para mainnet y no lo vendemos como tal. |
| ¿El scoring es IA de verdad? | No todavía: es un heurístico determinista, y es una elección — el score debe ser auditable y reproducible. El modelo entra después, sobre las trazas ya recogidas. |
| ¿El CID es IPFS real? | Es un stand-in determinista con la misma forma; el pinning real es el siguiente paso. |
| ¿Quién controla el contrato? | La wallet del equipo, vía `Ownable2Step` ya aceptado. En mainnet, Safe multisig. |

## Estado pendiente (no afirmar lo contrario en el pitch)

- El oráculo público de Monad todavía no está desplegado (Docker + `oracle/render.yaml` listos).
- El agente BNB **no** está desplegado: falta `bag platform login`, `bag wallet fund`,
  `bag erc8004 register` y `bag deploy --provider bnb` (trial de 48 h).
- No hay trabajos ERC-8183 reales todavía.
