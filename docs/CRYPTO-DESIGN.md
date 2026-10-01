# Diseño criptoeconómico de $COGN

## La respuesta corta

`$COGN` tiene tres funciones dentro de la arquitectura:

1. **Recompensar** la producción de trazas de razonamiento.
2. **Pagar** el acceso futuro a datos y servicios de evaluación.
3. **Coordinar** validadores, tesorería y gobernanza operativa.

La primera función existe en el MVP. Las funciones de acceso y coordinación
son el roadmap que debe convertirse en contratos y producto antes de
describirlas como utilidad activa.

## Oferta y protección contra inflación

| Regla | Diseño |
|---|---|
| Hard cap | 1.000.000.000 COGN |
| TGE | 600M de asignación inicial |
| Minería | 400M máximo, sólo vía oráculo |
| Circuit breaker | `maxRewardPerMint` limita cada mint |
| Duplicados | CID ya recompensado se rechaza |
| Vesting | equipo, inversores y tesorería tienen bloqueos |
| Quemar | reduce oferta; no reabre la cubeta de minería |

La escasez por sí sola no crea valor. El argumento económico sólido es que la
oferta nueva financia una contribución auditable y que, en el producto final,
la demanda proviene de compradores que necesitan esos datos.

## Quién gana y por qué

| Participante | Beneficio | Mecanismo |
|---|---|---|
| Productor | recompensa por una traza útil | firma + evaluación + mint |
| Comprador de datos | acceso a un corpus con procedencia | pago futuro en COGN |
| Validador | comisión por evaluar | staking/slashing futuro |
| Tesorería | financia liquidez y desarrollo | asignación con vesting |
| Holder | exposición a uso del protocolo, no garantía | demanda/escasez; sin promesa de rendimiento |

No debe decirse que un holder “gana” automáticamente. Puede beneficiarse si
crece la demanda, pero el token es volátil y no ofrece rentabilidad garantizada.

## Roadmap por capas

### Capa 1 — MVP

- problemas objetivos;
- firma EIP-712;
- scoring determinista;
- CID y evento on-chain;
- límites de emisión;
- vesting;
- dApp de demostración.

### Capa 2 — Producto de datos

- catálogo de trazas con permisos;
- API de búsqueda y acceso;
- pago en COGN;
- reparto automático al productor;
- quema o reserva parametrizada;
- métricas de calidad y procedencia.

### Capa 3 — Descentralización

- múltiples evaluadores;
- staking y slashing;
- comité o consenso de validación;
- rotación de oráculos;
- multisig de tesorería;
- auditoría externa.

## Riesgos que el equipo debe vigilar

1. **Sybil:** muchas wallets pueden farmear recompensas. Mitigaciones:
   problemas por usuario, reputación, límites y validación más costosa.
2. **Copiado:** un banco fijo y público puede tener soluciones copiadas.
   Mitigación: problemas rotativos, datos ocultos y pruebas de trabajo.
3. **Oráculo único:** una clave comprometida puede emitir hasta los límites.
   Mitigación: rotación, multisig operativo y validación independiente.
4. **Demanda insuficiente:** hard cap no equivale a valor. Mitigación:
   compradores piloto y contratos de acceso antes de ampliar emisiones.
5. **Privacidad:** una traza puede contener información sensible. Mitigación:
   consentimiento, redacción, control de acceso y política de retención.

## Regla para el pitch

Decir:

> “El MVP prueba una economía de contribución: se recompensa una traza
> firmada y verificable. El siguiente paso es convertir esas trazas en un
> mercado donde los compradores paguen por acceder a datos útiles.”

No decir:

> “El token está respaldado por ingresos” o “los holders obtienen rendimiento”

hasta que existan compradores, flujo de pagos y contratos desplegados que lo
demuestren.
