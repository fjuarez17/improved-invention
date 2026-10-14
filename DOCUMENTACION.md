# CalchAI · $COGN — Documentación técnica y económica

Documento único para jueces, inversores y desarrolladores. Cubre qué es el sistema, cómo está construido, **qué respalda al token**, cómo operarlo y cómo auditarlo.

---

## 1. Qué es

CalchAI es un mercado descentralizado de **trazas de razonamiento**: un usuario resuelve un problema explicando su razonamiento, un oráculo lo evalúa, y si el razonamiento aporta valor se acuña $COGN al usuario dejando en la blockchain un **recibo criptográfico** (el CID de la traza). El token no es un cupón promocional: es la unidad de cuenta con la que se compra y se paga ese corpus de datos.

Tres actores, con poderes separados en el contrato:

| Actor | Quién es | Qué puede hacer |
|---|---|---|
| Owner | Wallet del equipo (`0x55D9…0847`; en mainnet, un Safe multisig) | Rotar el oráculo, ajustar `maxRewardPerMint`, crear calendarios de vesting. **No puede acuñar recompensas.** |
| Oráculo | Wallet del backend (`0x9aBB…e8e3`) | Únicamente `mintCognitiveReward`, dentro del cupo de 400M y del límite por emisión. |
| Usuario | Estudiante / investigador | Recibe $COGN, transfiere, quema, reclama vesting. |

## 2. Arquitectura

```
Usuario ──razonamiento──▶ dApp (React + ethers v6)
                              │
                              ▼  POST /evaluate
                   Oráculo (FastAPI, wallet dedicada)
                     · puntúa la traza (0-100)
                     · genera el CID del razonamiento
                     · cooldown por wallet + presupuesto diario
                     · comprueba rewardedReasoning() antes de firmar
                              │
                              ▼  mintCognitiveReward(user, amount, cid)
                   CognitionToken  (Monad Testnet, chainId 10143)
                     · hard cap 1B · cubeta de minería 400M
                     · evento CognitiveRewardMinted(user, amount, cid)
                              │
                   CognitionVesting (TGE / cliff / lineal, irrevocable)
```

Componentes del repositorio:

| Ruta | Rol |
|---|---|
| `contracts/CognitionToken.sol` | ERC-20 (Permit, Burnable, Ownable2Step) con minería cognitiva. |
| `contracts/CognitionVesting.sol` | Bóveda de vesting irrevocable, varios calendarios por beneficiario. |
| `scripts/tokenomics.js` | Fuente única de verdad de la distribución y el calendario. |
| `scripts/deploy.js` | Despliegue + configuración del oráculo + creación de calendarios. |
| `scripts/transferOwnership.js` | Transferencia Ownable2Step del token y del vault. |
| `oracle/server.js` | Oráculo de desarrollo (Node, puerto 8787). |
| `oracle/app/main.py` | Oráculo de producción (FastAPI) con cooldown y presupuesto diario. |
| `web/` | dApp: dashboard, minería en vivo, vesting on-chain, enlaces al explorer. |

## 2.bis Publicar el oráculo (hosting)

El oráculo se empaqueta con Docker y puede levantarse en cualquier PaaS. En Render basta con
importar el repo y usar el blueprint `oracle/render.yaml` (plan free, health check en `/health`);
en Fly.io o Railway se usa el mismo `oracle/Dockerfile`.

```bash
# local, idéntico al contenedor
docker build -t calchai-oracle oracle
docker run -p 8000:8000 -e ORACLE_PRIVATE_KEY=... calchai-oracle
```

`ORACLE_PRIVATE_KEY` se configura como secreto en el panel del proveedor: nunca se commitea.
La wallet del oráculo necesita saldo MON para gas; `/health` lo expone en `gasBalanceMon`.

La dApp publicada acepta `?oracle=https://<url-del-oraculo>` en la URL: guarda ese valor en
`localStorage`, así que se puede repuntar el frontend sin reconstruirlo.

## 3. Respaldo del token (qué sostiene a $COGN)

El respaldo no es una promesa: son cuatro capas verificables.

1. **Respaldo por producción de datos.** Cada $COGN minado existe porque se produjo una traza de razonamiento evaluada, cuyo CID queda escrito en el evento `CognitiveRewardMinted`. La oferta nueva está atada 1:1 a un activo (el dato) que el protocolo puede vender. Si nadie razona, no nace ni un token.
2. **Respaldo por demanda de uso.** Los compradores del corpus (laboratorios de IA, empresas que necesitan datos de razonamiento humano para fine-tuning y evaluación) pagan en $COGN. La API de consumo y el staking de los validadores humanos son sumideros de demanda recurrente, no eventos únicos.
3. **Respaldo por escasez verificable.** Hard cap de 1.000.000.000 imposible de superar a nivel de bytecode; `totalMined` impide que la minería exceda 400M **aunque se quemen tokens** (quemar no reabre cupo, así que el techo efectivo sólo baja). El float del día 1 es de 110M (11%): el 89% restante está bloqueado en contrato y es auditable.
4. **Respaldo por tesorería y liquidez.** El 20% (200M) de Tesorería/Ecosistema existe para proveer liquidez en DEXs de Monad, pagar a validadores humanos y financiar grants; se libera 5% en TGE, cliff de 3 meses y lineal a 36 meses, de modo que no puede vaciarse de golpe.

Antidilución y alineación: equipo (cliff 12 meses, lineal 48) e inversores (cliff 6 meses, lineal 24) no pueden vender antes de tiempo porque el contrato de vesting **no tiene función de rescate** sobre lo ya comprometido.

Ver [TOKENOMICS.md](./TOKENOMICS.md) para la tabla completa y la curva de emisión.

## 4. Seguridad y controles

| Riesgo | Control implementado |
|---|---|
| Emisión arbitraria | `mintCognitiveReward` sólo la puede llamar el oráculo; ni el owner puede acuñar. |
| Backend comprometido | `maxRewardPerMint` (freno de mano on-chain) + rotación del oráculo por el owner. |
| Doble cobro del mismo razonamiento | `rewardedReasoning[keccak256(cid)]`: un CID se paga una sola vez; el oráculo además lo comprueba antes de firmar y devuelve HTTP 409. |
| Inflación por quema | Quemar no reabre cupo de minería (`totalMined` es monótono). |
| Pérdida de ownership | `Ownable2Step`: el destinatario debe aceptar explícitamente. |
| Abuso de la demo pública | Cooldown por wallet (`ORACLE_COOLDOWN_SECONDS`, 120s) y presupuesto diario de emisión (`ORACLE_DAILY_BUDGET`, 5.000 COGN). |
| Oráculo sin gas en directo | `/health` expone `gasBalanceMon` de la wallet del oráculo. |

Puntos que son explícitamente *stubs* de hackathon, documentados para no engañar a nadie: `score_reasoning()` es un evaluador heurístico (profundidad, pasos, conclusión) en el lugar donde irá Vertex AI, y `fake_cid()` es un CID determinista donde irá el pinning real a IPFS. Ambos son los dos únicos puntos de integración pendientes; el resto es real y está on-chain.

## 5. Direcciones desplegadas (Monad Testnet, chainId 10143)

| Qué | Dirección |
|---|---|
| CognitionToken ($COGN) | [`0x3721E5c3162FEA106ddC42baBAcEF09664EF625F`](https://testnet.monadexplorer.com/address/0x3721E5c3162FEA106ddC42baBAcEF09664EF625F) |
| CognitionVesting | [`0xe5b63EE0BF037a0535E7f13a406019b3b7D5DF9A`](https://testnet.monadexplorer.com/address/0xe5b63EE0BF037a0535E7f13a406019b3b7D5DF9A) |
| Owner (token y vault) | `0x55D931170F318beb8E794279415208cfAa770847` |
| Oráculo (backend) | `0x9aBB079F3750D1DAd46c6c35bC1404c355bBe8e3` |

Ambos contratos están verificados vía Sourcify en el explorer de Monad. Red: `https://testnet-rpc.monad.xyz/` · símbolo `MON`.

## 6. Operación

### Local

```bash
npm install
npx hardhat test          # 16 tests
npm run oracle            # oráculo Node en :8787
npm run web               # dApp en :5173
```

### Oráculo de producción (FastAPI)

```bash
cd oracle
python3 -m venv .venv && .venv/bin/pip install -e .
ORACLE_PRIVATE_KEY=0x... .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8787
```

Variables: `ORACLE_PRIVATE_KEY` (obligatoria), `MONAD_RPC_URL`, `TOKEN_ADDRESS`, `VESTING_ADDRESS`, `ORACLE_COOLDOWN_SECONDS`, `ORACLE_DAILY_BUDGET`.

Endpoints:

- `GET /health` → oráculo configurado, oráculo on-chain, saldo de gas, presupuesto gastado hoy.
- `POST /evaluate` `{ "user": "0x…", "reasoning": "…" }` → `200` con `txHash` y enlace al explorer, `400` traza demasiado corta, `409` CID duplicado, `429` cooldown o presupuesto agotado.

### dApp

```bash
cd web && VITE_ORACLE_API=https://<oraculo-publico> npm run build   # genera web/dist
```

## 7. Runbook de la demo ante los jueces

1. Abrir la dApp pública y mostrar el dashboard: hard cap 1B, cubeta de minería 400M, supply real leído de Monad.
2. Conectar MetaMask (la dApp añade la red Monad Testnet sola) y mostrar el balance $COGN.
3. Pegar un razonamiento nuevo y pulsar evaluar → aparece la puntuación, el CID y el enlace a la transacción en el explorer; sube `totalMined`.
4. Repetir el **mismo** razonamiento → el sistema lo rechaza (CID duplicado): demuestra que no se puede cobrar dos veces el mismo dato.
5. Mostrar la tabla de vesting: equipo e inversores a 0% hasta su cliff; tesorería al 5%.
6. Cerrar con el explorer: contratos verificados y el evento `CognitiveRewardMinted` con el CID.

Checklist previo: la wallet del oráculo tiene MON (`/health`), el presupuesto diario no está agotado, y el razonamiento de demo es uno que nunca se ha usado.

## 8. Hoja de ruta post-hackathon

1. Sustituir el evaluador heurístico por Vertex AI (mismo contrato, misma interfaz HTTP).
2. Pinning real a IPFS y publicación del corpus consultable.
3. Owner → Safe multisig y auditoría externa antes de mainnet.
4. Curva de emisión por épocas aplicada en el backend, con el tope on-chain como último recurso.
5. Mercado de compra de trazas: pagos en $COGN y staking de validadores humanos.
