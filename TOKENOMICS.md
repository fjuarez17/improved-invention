# Tokenomics $COGN

**Hard cap: 1.000.000.000 $COGN** (18 decimales). Sin función de emisión discrecional: 600M se acuñan en el despliegue y 400M sólo pueden nacer como recompensa de razonamiento validado.

## Distribución

| Categoría | % | Tokens | TGE | Cliff | Vesting |
|---|---|---|---|---|---|
| Minería Cognitiva | 40% | 400M | 0% | Ninguno | Emisión algorítmica por uso (10 años) |
| Tesorería / Ecosistema | 20% | 200M | 5% | 3 meses | Lineal 36 meses |
| Equipo Fundador | 15% | 150M | 0% | 12 meses | Lineal 48 meses |
| Inversores | 15% | 150M | 0% | 6 meses | Lineal 24 meses |
| Airdrop / Testnet | 10% | 100M | 100% | Ninguno | Inmediato |

Float en circulación el día del TGE: **110M (11%)** = airdrop completo (100M) + 5% de tesorería (10M). Todo lo demás está bloqueado en contrato y es verificable on-chain.

## Captura de valor

- **Demanda:** laboratorios y empresas de IA pagan en $COGN por acceso a trazas de razonamiento verificadas; cada compra de datos es demanda real del token, no especulación.
- **Oferta:** sólo crece cuando se produce conocimiento nuevo y auditable (`mintCognitiveReward` con CID de IPFS). Emisión atada a producción, no a tiempo.
- **Sumideros:** pagos de API, staking de validadores humanos de datos y quema opcional (`burn`) — quemar no reabre cupo de minería, así que el suministro es monótonamente decreciente respecto al cap.

## Curva de emisión sugerida (minería, 400M / 10 años)

Emisión con halving anual suave: el presupuesto del año *n* es `400M × 0.5^(n/3.5)` normalizado a 10 años, con un tope por época que el backend hace cumplir y `maxRewardPerMint` como límite duro on-chain. Así los primeros usuarios se llevan más, sin inflacionar el precio cuando llegue liquidez real.

## Cómo se verifica (para los jueces)

```
token.MAX_SUPPLY()            -> 1e27 (1B)
token.totalSupply()           -> 6e26 el día 1
token.remainingMiningSupply() -> 4e26 y sólo baja
vesting.vestedAmount(equipo)  -> 0 durante los primeros 12 meses
```
