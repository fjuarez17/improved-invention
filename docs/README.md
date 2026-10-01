# CalchAI / $COGN — índice del proyecto

Este directorio es la puerta de entrada para cualquier miembro del equipo. La
documentación distingue explícitamente entre lo que está desplegado y probado
en Monad Testnet y lo que pertenece al diseño futuro.

## Ruta recomendada

1. **[Onboarding del equipo](./TEAM-ONBOARDING.md)** — propósito, repositorios,
   instalación, responsabilidades y primeros comandos.
2. **[Arquitectura y flujos](./FLOWS.md)** — cómo circulan la traza, la firma,
   la evaluación, el CID y la recompensa.
3. **[Diseño criptoeconómico](./CRYPTO-DESIGN.md)** — utilidad de $COGN,
   captura de valor, emisión, vesting, riesgos y roadmap.
4. **[Documentación técnica completa](../DOCUMENTACION.md)** — referencia
   operativa, controles y runbook de la demo.
5. **[Tokenomics](../TOKENOMICS.md)** — distribución, hard cap y calendario.

## Mapa rápido

```text
contracts/          contratos ERC-20 y vesting
scripts/            despliegue, configuración y operaciones on-chain
oracle/app/         API FastAPI: firma, evaluación, pinning y mint
oracle/tests/       pruebas del flujo de reclamación
web/                dApp React + ethers v6
deployments/        direcciones de despliegues conocidos
docs/               onboarding y diseño explicado para el equipo
```

El agente de BNB (`cognreasoner`) vive en su repositorio/proyecto separado y
replica el scoring determinista del oráculo. No copiar sus keystores ni su
carpeta `.studio/wallets/` a este repositorio.

## Regla de lectura

Cuando una afirmación comercial no esté respaldada por un contrato, un test,
una respuesta de API o una transacción verificable, debe presentarse como
**roadmap**, no como funcionalidad disponible.
