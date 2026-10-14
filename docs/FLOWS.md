# Flujos del sistema

## Flujo A — Recompensa verificable

```text
Wallet usuario
   │
   ├─ POST /claim-payload
   │      └─ domain + ReasoningClaim + nonce
   │
   ├─ signTypedData(EIP-712)
   │
   └─ POST /evaluate
          ├─ recover signer == user
          ├─ nonce no usado
          ├─ problemId conocido
          ├─ respuesta correcta
          ├─ traza usa datos del problema
          ├─ score + límites + cooldown + presupuesto
          ├─ pin_trace(reasoning)
          ├─ rewardedReasoning(cid) == false
          └─ token.mintCognitiveReward(user, amount, cid)
```

La firma vincula:

```text
beneficiario + hash exacto de la traza + problemId + answer + nonce
      + chainId + contrato verificante
```

Cambiar cualquiera de esos valores invalida la autorización.

## Flujo B — Recompensa libre

Una traza sin `problemId` puede usarse para demostrar la UX, pero no tiene
verificación objetiva. El oráculo aplica `FREEFORM_MAX_COGN` y el score de
calidad; por diseño paga mucho menos que una solución comprobable.

## Flujo C — Rechazos esperados

| Situación | Respuesta | Motivo |
|---|---:|---|
| Firma ausente o incorrecta | 401 | sólo el beneficiario puede cobrar |
| Firma malformada | 401 | no debe convertirse en error 500 |
| Problema desconocido | 400 | el oráculo no inventa validaciones |
| Respuesta incorrecta | 200, score 0 | no hay recompensa |
| Traza ajena con respuesta correcta | 200, score 0 | no usa los datos del problema |
| Nonce repetido | 409 | protección anti-replay |
| CID ya recompensado | 409 | una traza no cobra dos veces |
| Cooldown o presupuesto | 429 | límite temporal/diario |

La dApp debe mostrar el `reason` entregado por la API. Un error de red sí puede
indicar que el oráculo no está corriendo; un rechazo de negocio no debe
ocultarse detrás de ese mensaje.

## Flujo D — Contratos y roles

```text
Owner
 ├─ configura oracleAddress
 ├─ ajusta maxRewardPerMint
 ├─ crea schedules de vesting
 └─ no llama mintCognitiveReward

Oracle
 └─ llama mintCognitiveReward / batch

Usuario
 ├─ recibe y transfiere COGN
 ├─ puede quemar COGN
 └─ reclama lo que haya liberado su schedule
```

El contrato limita el suministro total a 1B y la cubeta de minería a 400M.
Quemar tokens no reabre la cubeta. `Ownable2Step` evita completar una
transferencia de ownership con una dirección equivocada.

## Flujo E — Evolución económica

### MVP confirmado

```text
traza → evaluación → recompensa → recibo on-chain
```

### Mercado objetivo

```text
comprador paga COGN
       ├─ productor recibe parte
       ├─ validadores reciben parte
       └─ protocolo quema o reserva parte
```

Este segundo diagrama es diseño de producto, no una capacidad que deba
presentarse como ya desplegada.
