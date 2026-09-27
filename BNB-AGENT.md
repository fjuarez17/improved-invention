# cognreasoner — agente vendedor de CalchAI en BNB Chain

Agente generado con **BNB Agent Studio** (`bag init`) que vende el servicio de
*Proof of Reasoning* de CalchAI: recibe un problema y la traza de razonamiento
del usuario y devuelve puntuación (0-100), feedback metacognitivo y el CID que
ancla la traza. Es la contraparte en BSC del oráculo que ya emite `$COGN` en
Monad Testnet.

- Carpeta: `bnb-agent/` (workspace de Studio; el agente vive en `bnb-agent/app/agent`)
- Red: `bsc-testnet` · Wallet: `evm-local` (keystore fuera del repo) · LLM: `pieverse-llm` (`auto/free`)
- Interfaces: A2A + MCP + x402 (rail ERC-8183 activo) · Precio: 0 USD (FREE)
- Identidad on-chain: ERC-8004 · Trabajos/escrow: ERC-8183

## Qué hace el agente (código propio)

`app/agent/src/reasoningEval.ts` es la lógica de CalchAI. La puntuación y el
CID son **código fijo determinista** — el LLM sólo redacta el feedback y nunca
puede alterar la nota:

| Componente | Peso | Criterio |
|---|---|---|
| `depth` | 50 | extensión efectiva del razonamiento (≈120 palabras satura) |
| `structure` | 30 | pasos explícitos (`1.`, `-`, `*`); 5 pasos saturan |
| `conclusion` | 20 | cierre explícito ("por lo tanto", "en resumen", …) |

`rewardEligible` es `score >= 40`, el mismo umbral que exige el oráculo de
Monad antes de mintear `$COGN`, y `reasoningCid` usa el mismo esquema
determinista (`bafy` + sha256) que `oracle/app/main.py`, de modo que la misma
traza produce el mismo CID en ambas cadenas.

`app/agent/src/dualMain.ts` conecta esa evaluación al hook `runWork`, que es el
que usan los tres rails (A2A/ERC-8183, MCP y x402).

Respuesta tipo:

```json
{
  "status": "evaluated",
  "score": 100,
  "breakdown": { "depth": 50, "structure": 30, "conclusion": 20 },
  "metacognitiveDelta": "El salto lógico más débil es …",
  "reasoningCid": "bafy60abe6dfb0a621b0b4788da4df5f8e51c41c9d23843115",
  "rewardEligible": true,
  "timestamp": "2026-09-27T18:47:24.450Z"
}
```

## Requisitos

```bash
node -v        # >= 22
pnpm -v        # 10+ (corepack enable)
bun -v         # >= 1.3 (obligatorio para el deploy)
npm i -g @bnbagent/studio-cli && bag --version
```

## Puesta en marcha

```bash
cd bnb-agent/app/agent
pnpm install                     # desde bnb-agent/ si es la primera vez
bag wallet new --generate-password   # wallet desechable del agente
bag llm activate                 # Pieverse zero-deposit (modelo auto/free)
bag doctor                       # diagnóstico
bag dev                          # A2A + MCP + x402 en http://localhost:9000
```

Prueba local (rail x402 en modo FREE):

```bash
curl -s -X POST http://localhost:9000/x402 -H 'content-type: application/json' \
  -d '{"prompt":"{\"problemContext\":\"...\",\"reasoningTrace\":\"1. ...\\n2. ...\\nPor lo tanto ...\"}"}'
```

## Fondeo e identidad on-chain

`bag doctor` avisa de lo que falta. Para escrow ERC-8183 y registro ERC-8004 la
wallet necesita ≥ 0.02 tBNB:

```bash
bag platform login          # GitHub (abre URL + código)
bag wallet fund             # tBNB + U del workshop
bag wallet balance
bag erc8004 register        # identidad on-chain del agente
bag erc8004 show
```

Alternativa al faucet gestionado: bot de Telegram `@bnbchain_official_bot`
(pedir tBNB y U para la dirección del agente).

## Despliegue (trial de 48 h en la plataforma de BNB Chain)

```bash
bag deploy prepare
bag deploy --provider bnb
bag deploy verify --provider bnb
bag deploy status && bag deploy logs
bag platform credit          # tiempo restante del trial
```

El trial transmite la clave de la wallet al operador: usar **siempre** una
wallet desechable de testnet (la creada con `bag wallet new`), nunca la wallet
que controla los contratos de Monad.

## Operar trabajos ERC-8183

```bash
bag erc8183 list
bag erc8183 status <jobId>
bag erc8183 submit <jobId> "Resultado de la evaluación con CID"
bag erc8183 settle <jobId>
```

## Seguridad — invariantes que no se tocan

- El keystore vive en `.studio/wallets/` del workspace y está fuera de Git; el
  `.env.local` (contraseña de la wallet, API key de Pieverse) tampoco se commitea.
- La firma es código fijo en `signing.ts`; nunca una herramienta del LLM.
- Las herramientas MCP expuestas al LLM son de sólo lectura.
- El precio sale de `studio.toml`; el LLM no participa en la cotización.

## Relación con el MVP de Monad

| | Monad Testnet | BNB Chain Testnet |
|---|---|---|
| Rol | emisión de `$COGN` por razonamiento validado | venta del servicio de evaluación como agente |
| Componente | `oracle/app/main.py` + `CognitionToken.sol` | `bnb-agent/app/agent` (A2A/MCP/x402) |
| Identidad | wallet de oráculo autorizada en el contrato | ERC-8004 |
| Prueba | evento `CognitiveRewardMinted` con CID | entregable ERC-8183 con el mismo CID |

El scoring y el CID son idénticos en ambos lados, así que una traza evaluada
por el agente de BNB puede liquidarse como recompensa `$COGN` en Monad sin
recalcular nada.
