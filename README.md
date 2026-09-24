# CalchAI — $COGN (Proof of Reasoning) — MVP on Monad

Smart contracts del token $COGN: hard cap de 1.000.000.000, emisión de recompensas controlada por el Oráculo de CalchAI con recibo criptográfico (CID de IPFS), y bóveda de vesting con TGE + cliff + liberación lineal.

- `contracts/CognitionToken.sol` — ERC-20 (Permit + Burnable, Ownable2Step). 600M se acuñan en el TGE; los 400M de Minería Cognitiva sólo puede emitirlos el oráculo.
- `contracts/CognitionVesting.sol` — bóveda de vesting irrevocable por beneficiario (TGE %, cliff, lineal).
- `scripts/tokenomics.js` — única fuente de verdad de la distribución y el calendario.
- `scripts/deploy.js` — despliegue + configuración del oráculo + creación de los calendarios de vesting.
- `scripts/mintReward.js` — ejemplo de lo que hace tu backend (Vertex AI) al validar un razonamiento.

## Setup

```bash
npm install
cp .env.example .env    # pon tu PRIVATE_KEY de la wallet de despliegue
npx hardhat compile
npx hardhat test
```

## Desplegado en Monad Testnet (chainId 10143)

| Contrato | Dirección (verificada en el explorer) |
|---|---|
| CognitionToken ($COGN) | [`0x3721E5c3162FEA106ddC42baBAcEF09664EF625F`](https://testnet.monadexplorer.com/address/0x3721E5c3162FEA106ddC42baBAcEF09664EF625F) |
| CognitionVesting | [`0xe5b63EE0BF037a0535E7f13a406019b3b7D5DF9A`](https://testnet.monadexplorer.com/address/0xe5b63EE0BF037a0535E7f13a406019b3b7D5DF9A) |

Recompensa cognitiva de demo (25 COGN con CID de IPFS como recibo): [`0x5e131454ac22c6913eebe89854f59d35dacedb31dde76b6552a3844851040f1f`](https://testnet.monadexplorer.com/tx/0x5e131454ac22c6913eebe89854f59d35dacedb31dde76b6552a3844851040f1f)

## Volver a desplegar

```bash
npx hardhat run scripts/deploy.js --network monadTestnet
```

Guarda las direcciones en `deployments/monadTestnet.json`. Si no defines las direcciones por categoría en `.env`, todas apuntan al deployer (suficiente para la demo del hackathon).

Recompensar un razonamiento validado:

```bash
USER_ADDRESS=0x... AMOUNT=25 CID=bafy... npx hardhat run scripts/mintReward.js --network monadTestnet
```

Red: `https://testnet-rpc.monad.xyz/` · Chain ID `10143` · Símbolo `MON` · Explorer `https://testnet.monadexplorer.com`.

Verificar código fuente (Monad usa Sourcify, no Etherscan):

```bash
npx hardhat verify --network monadTestnet <TOKEN> <OWNER> <ALLOCATION_RECEIVER>
```

## Propiedad de los contratos

Ownable2Step en dos pasos: el owner actual propone y el destinatario confirma.

```bash
NEW_OWNER=0x... npx hardhat run scripts/transferOwnership.js --network monadTestnet
```

El destinatario acepta desde la dApp (aparece un aviso "Aceptar ownership" al conectar la wallet pendiente) o llamando `acceptOwnership()` en el token y en el vault. En mainnet el destinatario debe ser un Safe multisig; en testnet basta la wallet del equipo.

## Demo (dApp + servicio de oráculo)

```bash
npm run oracle      # servicio del oráculo en :8787 (firma con ORACLE_PRIVATE_KEY)
npm run web         # dApp en :5173
```

Flujo de la demo ante los jueces: conectar MetaMask (la dApp añade Monad Testnet sola) → pegar un razonamiento → el oráculo lo puntúa, genera el CID y acuña $COGN → aparece el recibo con enlace al explorer, sube el contador de minería y el balance del usuario. Abajo, la tabla de vesting leída on-chain muestra que equipo e inversores siguen a 0% hasta su cliff.

- `oracle/app/main.py` — oráculo de producción (FastAPI) con cooldown por wallet y presupuesto diario de emisión; es el que se despliega público.
- `oracle/server.js` — servicio backend con la wallet del oráculo. `scoreReasoning()` es el stub de Vertex AI (profundidad, pasos, conclusión) y `fakeCid()` el stand-in del pinning a IPFS: son los dos puntos de integración reales.
- `web/` — dApp React + ethers v6, sólo lectura salvo conectar wallet y reclamar vesting.

## Decisiones de diseño que los jueces van a mirar

1. **Hard cap y cubeta de minería separada.** El contrato no sólo limita el suministro total a 1B: `totalMined` impide que la minería cognitiva supere nunca los 400M, incluso si alguien quema tokens (quemar no reabre espacio de emisión).
2. **Emisión sólo por oráculo, con freno de mano.** Ni el owner puede acuñar recompensas. `maxRewardPerMint` limita el daño si la wallet del backend se ve comprometida, y el owner puede rotar el oráculo.
3. **Recibo criptográfico por razonamiento.** Cada emisión lleva el CID de IPFS de la traza de razonamiento y se registra en `rewardedReasoning`, así que el mismo razonamiento no se puede cobrar dos veces y cualquiera puede auditar en Monad por qué se pagó.
4. **Vesting irrevocable.** Equipo (cliff 12m, lineal 48m) e inversores (cliff 6m, lineal 24m) no pueden desbloquear antes de tiempo: no hay función de rescate sobre tokens ya comprometidos.
5. **Ownable2Step + ERC20Permit.** Evita perder el control por transferir ownership a una dirección errónea, y permite aprobaciones sin gas para la UX del estudiante.

Ver [TOKENOMICS.md](./TOKENOMICS.md) para la distribución y el calendario completos, y [DOCUMENTACION.md](./DOCUMENTACION.md) para la arquitectura, el respaldo del token, los controles de seguridad y el runbook de la demo.
