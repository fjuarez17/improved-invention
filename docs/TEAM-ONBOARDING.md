# Onboarding del equipo

## 1. Qué problema resolvemos

CalchAI crea un mercado de trazas de razonamiento humano. Un productor explica
cómo llegó a una respuesta; el protocolo comprueba la autoría y, cuando el
problema es verificable, comprueba también el resultado. La traza se conserva
con un identificador y la recompensa se registra en Monad.

La tesis es sencilla:

```text
productor crea una traza útil
        ↓
oráculo verifica autoría + calidad + resultado
        ↓
protocolo paga $COGN y registra un recibo auditable
        ↓
comprador futuro paga $COGN por acceder a datos útiles
```

La última flecha —el acceso comercial pagado a los datos— es una capa futura.
El MVP ya demuestra la producción, evaluación, recibo y emisión limitada; no
debe afirmarse que existe todavía un mercado de datos descentralizado completo.

## 2. Qué hay en cada capa

| Capa | Ubicación | Responsabilidad |
|---|---|---|
| Contrato monetario | `contracts/CognitionToken.sol` | ERC-20, hard cap, minería, anti-duplicado y permisos |
| Vesting | `contracts/CognitionVesting.sol` | TGE, cliff, liberación lineal e irrevocabilidad |
| Operaciones | `scripts/` | deploy, ownership, oracle y mint manual de prueba |
| Oráculo | `oracle/app/` | EIP-712, problemas, scoring, pinning y transacción de mint |
| dApp | `web/` | conexión de wallet, firma, envío y lectura on-chain |
| Pruebas | `test/`, `oracle/tests/` | invariantes de contratos y seguridad funcional |
| Despliegues | `deployments/` | direcciones y parámetros conocidos por red |

## 3. Preparación local

Requisitos: Node.js compatible con Hardhat, npm, Python 3.10+ y una wallet
EVM sólo para testnet. Nunca uses una private key de producción.

```bash
npm install
cp .env.example .env
npx hardhat compile
npx hardhat test

cd oracle
python3 -m venv .venv
.venv/bin/pip install -e .
.venv/bin/python -m pytest tests -q
cd ..

npm --prefix web install
npm --prefix web run build
npm --prefix web run lint
```

Para ejecutar la demo en dos terminales:

```bash
npm run oracle
npm run web
```

La dApp queda en `http://localhost:5173` y el oráculo en
`http://localhost:8787`. La URL del oráculo también se puede cambiar con
`?oracle=https://...`; ese valor se guarda en el navegador.

## 4. Configuración mínima del oráculo

Variables importantes:

| Variable | Propósito |
|---|---|
| `ORACLE_PRIVATE_KEY` | firma la transacción on-chain de recompensa |
| `MONAD_RPC_URL` | RPC de Monad Testnet |
| `TOKEN_ADDRESS` | contrato $COGN que recibe el mint |
| `ORACLE_REQUIRE_SIGNATURE` | debe permanecer `true` fuera de tests |
| `ORACLE_COOLDOWN_SECONDS` | límite por wallet |
| `ORACLE_DAILY_BUDGET` | límite agregado diario |
| `PINATA_JWT` / `IPFS_API_URL` | pinning real; sin ellos hay fallback determinista |
| `ORACLE_STATE_FILE` | persistencia de nonces y contadores |
| `ORACLE_ALLOWED_ORIGINS` | orígenes autorizados por CORS |

`ORACLE_PRIVATE_KEY`, `.env`, `oracle-state.json` y cualquier keystore son
secretos o estado operativo: no se suben al repositorio.

## 5. Cómo hacer una reclamación

1. El usuario conecta una wallet en Monad Testnet.
2. La dApp solicita `/claim-payload`.
3. La wallet firma typed data EIP-712 sin pagar gas.
4. La dApp envía `/evaluate` con razonamiento, problema, respuesta, nonce y
   firma.
5. El oráculo recupera el firmante y exige que coincida con `user`.
6. Para un problema conocido, verifica la respuesta y que la traza use datos
   del enunciado.
7. Calcula el score, aplica límites y busca el CID final.
8. Rechaza nonces o CIDs ya utilizados.
9. La wallet del oráculo llama a `mintCognitiveReward`.
10. La respuesta devuelve score, importe, estado de pinning y enlace al
    explorer.

Una traza libre puede servir para demo, pero tiene un tope mucho menor que una
respuesta verificable. Una respuesta correcta pegada sobre una traza ajena
debe producir cero.

## 6. Cómo presentar el proyecto

### Para un usuario

“Resuelves un problema, firmas tu contribución y recibes una recompensa
auditable. La firma prueba que la traza es tuya; el CID y el evento de Monad
prueban qué se recompensó.”

### Para un negocio

“Los laboratorios necesitan trazas de razonamiento de calidad para entrenar y
evaluar modelos. En la arquitectura objetivo pagarían $COGN por acceder a
ellas; una parte iría al productor y otra podría quemarse o financiar la
validación.”

### Qué no prometer todavía

- No hay acceso comercial pagado a datos desplegado.
- No hay quema automática por compra de datos.
- No hay staking ni red descentralizada de validadores.
- Un solo oráculo operativo firma los mints.
- Sin `PINATA_JWT` o `IPFS_API_URL`, el CID es un fallback determinista, no
  una prueba de pinning IPFS.
- El banco de problemas es público y fijo; producción requiere rotación o
  generación por usuario.

## 7. Responsabilidades sugeridas

| Rol | Revisa |
|---|---|
| Smart contracts | invariantes, permisos, supply, vesting y upgrades inexistentes |
| Backend/oráculo | firmas, replay, scoring, CORS, persistencia y gas |
| Frontend | UX de firma, errores HTTP, chain switching y explorer |
| Economía | utilidad, demanda, emisión, vesting y riesgos de mercado |
| Demo/operaciones | saldos, `/health`, URLs, wallet de prueba y runbook |

Todo cambio que altere emisión, firma, dominios EIP-712, hosts permitidos o
roles on-chain necesita revisión de contratos y backend, no sólo una revisión
visual del frontend.
