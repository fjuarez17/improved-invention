# Corpus de entrega para Monad

Este documento concentra los textos listos para el formulario y la evidencia que
conviene citar. Mantén la distinción entre capacidades ya verificadas y capas
de roadmap: esa precisión fortalece la propuesta.

## Datos principales

### Nombre del proyecto

```text
CalchAI — Proof of Reasoning Market
```

### Descripción de una línea

```text
CalchAI turns verifiable human reasoning traces into an auditable data market powered by the $COGN token on Monad.
```

Versión en español, si el formulario la acepta:

```text
CalchAI convierte trazas verificables de razonamiento humano en un mercado de datos auditable impulsado por $COGN en Monad.
```

### URL del repositorio

```text
https://github.com/fjuarez17/improved-invention
```

### dApp pública

```text
https://dist-zyczpjct.devinapps.com
```

Nota operativa: esta dApp lee el despliegue de Monad Testnet. Para una nueva
emisión de recompensas en vivo debe existir un oráculo activo; si se usa un
hosting nuevo, se abre la dApp con `?oracle=https://<url-del-oraculo>`.

### Contratos en Monad Testnet

```text
Network: Monad Testnet
Chain ID: 10143
Token COGN: 0x3721E5c3162FEA106ddC42baBAcEF09664EF625F
Vesting vault: 0xe5b63EE0BF037a0535E7f13a406019b3b7D5DF9A
Oracle signer: 0x9aBB079F3750D1DAd46c6c35bC1404c355bBe8e3
Owner/team wallet: 0x55D931170F318beb8E794279415208cfAa770847
```

Enlaces:

```text
https://testnet.monadexplorer.com/address/0x3721E5c3162FEA106ddC42baBAcEF09664EF625F
https://testnet.monadexplorer.com/address/0xe5b63EE0BF037a0535E7f13a406019b3b7D5DF9A
```

### Evidencia de recompensas reales

```text
Recompensa verificada:
https://testnet.monadexplorer.com/tx/0xd6313f7737b40b231f4621cc6f4a25ad56160e74a91adadadcdada5411ffcaa9

Recompensa de traza libre:
https://testnet.monadexplorer.com/tx/0x8073011604fad10eb9c559c2ca085845195d6d007e4307e148c69747cc5545c1

Recompensa histórica de la primera demo:
https://testnet.monadexplorer.com/tx/0x5e131454ac22c6913eebe89854f59d35dacedb31dde76b6552a3844851040f1f
```

## Descripción larga para el formulario

```text
CalchAI is a Proof of Reasoning market. The MVP turns a human reasoning trace into a signed, evaluated and auditable contribution, then issues a bounded $COGN reward on Monad Testnet.

A user connects an EVM wallet, writes how they solved a problem, and signs an EIP-712 claim. The signed payload binds the beneficiary address, the exact reasoning hash, the selected problem, the submitted answer, a nonce, the chain ID and the verifying token contract. The oracle verifies the signature, rejects replayed nonces, checks the answer when the problem is objectively verifiable, and requires the trace to use the problem's own data. A user cannot claim another person's trace, a malformed signature cannot become a server error, and a copied answer attached to unrelated reasoning receives zero.

After validation, the backend creates a content identifier for the trace. With Pinata or an IPFS gateway configured, the trace can be pinned; without those credentials the API returns an explicit deterministic fallback instead of pretending that IPFS storage happened. The oracle then checks whether the CID was already rewarded, applies per-wallet cooldown and a daily emission budget, and calls mintCognitiveReward on CognitionToken.

The smart contract layer enforces the monetary rules. $COGN has a fixed maximum supply of 1,000,000,000 tokens. The initial allocation is 600,000,000 and the cognitive-mining reserve is capped at 400,000,000. Only the configured oracle can mint rewards, a circuit breaker limits the amount per mint, each CID can only be rewarded once, and burning COGN does not reopen the mining reserve. CognitionVesting implements TGE, cliff and linear schedules for treasury, team and investors, reducing initial sell pressure and making the token distribution auditable.

The repository contains the Solidity contracts, Hardhat tests, deployment and operations scripts, the FastAPI evaluation oracle, the React + ethers v6 dApp, deployment metadata and onboarding documentation. The current verified flow is: signed claim → evaluated trace → CID receipt → bounded mint → public explorer evidence. Verified behavior includes correct-answer rewards, free-form rewards, wrong-answer rejection, duplicate-CID rejection, nonce replay rejection, cross-wallet signature rejection, malformed-signature rejection, cooldown rejection and the distinction between verified and non-verified rewards.

The economic thesis is that high-quality human reasoning traces are useful data for evaluating and training AI systems. COGN is not presented as a yield product or as a claim on company revenue. It is the unit used to reward production, and the intended market design uses COGN for paid access to reasoning data, validator incentives and selective burn or treasury capture. Those demand-side contracts are the next implementation layer and are explicitly documented as roadmap rather than as deployed functionality.

The project is designed to scale in stages. The MVP uses one deterministic oracle so the reward path is easy to audit. The next step is paid data access, where buyers pay COGN for licensed traces and value is routed to contributors and the protocol. A later stage adds multiple evaluators, staking, slashing and multisig governance so no single oracle controls evaluation or issuance. The key open challenges are semantic validation of arbitrary reasoning, preventing copied answers from public problems, privacy of traces, IPFS availability and market demand; the documentation calls these out directly.

CalchAI demonstrates a working economic loop on Monad: users create reasoning data, wallets prove authorship, the oracle applies objective checks, contracts bound issuance, and the explorer provides a public receipt. The next milestone is to connect that production loop to real buyers of reasoning data.
```

## Actualización de progreso sugerida

```text
CalchAI has a deployed and verified MVP on Monad Testnet. The current implementation includes CognitionToken, CognitionVesting, a FastAPI evaluation oracle, EIP-712 user-signed claims, objective answer validation, bounded reward issuance, duplicate-CID rejection, nonce replay protection, wallet cooldown, daily emission budget and a React dApp.

We tested the complete reward circuit end to end, including a verified 10 COGN reward, a free-form 1 COGN reward, wrong-answer rejection, duplicate-CID rejection, replay rejection, cross-wallet signature rejection and cooldown rejection. Contract tests cover the 1B hard cap, the 400M mining reserve, oracle-only minting, max reward limits and vesting schedules.

The repository now includes onboarding documentation, architecture and flow diagrams in prose, crypto-economic design notes, risk boundaries and a clear implemented-versus-roadmap map. Upcoming milestones are a public always-on oracle, real IPFS pinning credentials, paid access to reasoning data, validator staking/slashing and stronger problem generation to reduce copied-solution risk.
```

## Texto corto para el campo de progreso si hay límite

```text
Deployed MVP on Monad Testnet: COGN token, vesting vault, EIP-712 signed claims, objective scoring, anti-replay checks, bounded minting and React dApp. End-to-end rewards were tested with real testnet transactions. Next: public oracle uptime, real IPFS pinning and paid data access.
```

## Enlaces recomendados

```text
Repository:
https://github.com/fjuarez17/improved-invention

dApp:
https://dist-zyczpjct.devinapps.com

Token:
https://testnet.monadexplorer.com/address/0x3721E5c3162FEA106ddC42baBAcEF09664EF625F

Vesting:
https://testnet.monadexplorer.com/address/0xe5b63EE0BF037a0535E7f13a406019b3b7D5DF9A

Reward transaction:
https://testnet.monadexplorer.com/tx/0xd6313f7737b40b231f4621cc6f4a25ad56160e74a91adadadcdada5411ffcaa9
```

## Afirmaciones que sí están respaldadas

- Contratos desplegados en Monad Testnet.
- Token ERC-20 con cap fijo de 1B.
- Reserva de minería separada de 400M.
- Mint restringido al oráculo.
- Límite por recompensa.
- Rechazo de CID duplicado.
- Vesting con TGE, cliff y liberación lineal.
- Firma EIP-712 del beneficiario.
- Nonce anti-replay.
- Validación de respuestas objetivas.
- Tope diferente para traza libre y verificada.
- Cooldown y presupuesto diario.
- dApp funcional contra Monad Testnet.
- Tests de contratos y del oráculo.

## Afirmaciones que deben quedarse como roadmap

- Acceso pagado a trazas de razonamiento.
- Quema automática vinculada a consumo de datos.
- Staking, slashing y red de validadores.
- Oráculo descentralizado o multi-firma.
- IPFS real en producción sin credenciales configuradas.
- Validación semántica general de cualquier razonamiento.
- Demanda de mercado ya comprobada.
- Retorno financiero para holders.

## Checklist antes de hacer público el repo

- `README.md` explica qué está implementado y qué es roadmap.
- `docs/README.md` guía al equipo nuevo.
- `.env`, `oracle-state.json`, `node_modules`, `dist`, caches y keystores no están versionados.
- No hay private keys ni seed phrases en archivos rastreados.
- Las direcciones públicas y hashes de transacción sí pueden publicarse.
- Mergear `#3`, luego `#5`, luego `#6` para que `main` contenga el sistema endurecido.
- Después del merge, verificar que `main` compile y que los links del README funcionen.
