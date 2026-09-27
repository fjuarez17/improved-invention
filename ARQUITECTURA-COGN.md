# Qué funciona hoy, qué se va a romper, y cómo debería ser la arquitectura

Documento honesto de estado y diseño. Sin marketing: si algo es un stub, lo dice.

## 1. Qué es funcional hoy, por capas

| Capa | Estado | Nivel de confianza |
| --- | --- | --- |
| Contrato `CognitionToken` (hard cap, cubeta de minería, anti-doble-CID, cortafuegos, Ownable2Step) | Desplegado y verificado en Monad testnet, 16 tests | **Producción-ready salvo auditoría externa** |
| Contrato `CognitionVesting` (TGE/cliff/lineal, irrevocable) | Desplegado y verificado | **Producción-ready salvo auditoría externa** |
| dApp (lectura de supply, vesting, eventos; emisión vía oráculo) | Pública y operando | Demo sólida |
| Oráculo (scoring + firma + guardarraíles) | Funciona, corre en una sola máquina, sin URL pública todavía | **Prototipo** |
| Scoring "Proof of Reasoning" | Heurístico determinista (palabras, pasos, conclusión) | **Stub honesto** |
| CID | SHA-256 con prefijo `bafy`, reproducible, **no publicado en IPFS** | **Stub honesto** |
| Agente vendedor BNB (A2A/MCP/x402, cotización firmada, ERC-8183) | Corre en local, misma evaluación que Monad (200/200 trazas idénticas) | Prototipo verificado localmente |
| Identidad ERC-8004 / despliegue BNB | No hecho | Pendiente |

Resumen en una frase: **la capa monetaria es seria; la capa de evaluación es un
stub deliberado**. Eso está bien para un hackathon si lo dices tú antes de que lo
descubra un juez, y es fatal si lo ocultas.

## 2. Los siete fallos previsibles, en orden de probabilidad

### 2.1 El scoring se farmea en cinco minutos (crítico)
El evaluador premia longitud, viñetas y la palabra "por lo tanto". Un script que
genere 130 palabras con cinco bullets y un "por lo tanto" saca 100/100 siempre.
Con la cubeta de 400M, alguien con un bucle y gas barato vacía la emisión.
Hoy sólo lo frenan el cooldown por wallet y el presupuesto diario — y el cooldown
por wallet no sirve contra mil wallets.

### 2.2 No hay prueba de que el que cobra sea el que razonó (crítico)
El endpoint del oráculo acepta la dirección `user` que le pasa quien llama. No hay
firma del usuario. Cualquiera puede pedir recompensas hacia su propia wallet
usando texto ajeno. **Este es el agujero más barato de tapar y el más vergonzoso
si lo encuentra un juez.**

### 2.3 El oráculo es un único punto de fallo y de confianza
Una wallet, un servidor, una clave. Si se queda sin gas, la demo muere en
directo. Si se filtra la clave, el atacante emite hasta `maxRewardPerMint` por tx
sin límite de txs. Si el servidor cae, el protocolo deja de funcionar entero.

### 2.4 El CID no prueba nada todavía
Un CID que no está pinneado en ningún sitio es un hash: demuestra integridad si
alguien conserva el texto, pero nadie lo conserva. Hoy el "recibo criptográfico"
apunta al vacío. Un juez técnico lo va a preguntar.

### 2.5 El token no tiene sumidero (el fallo económico de fondo)
Hay emisión (minería) y no hay destrucción ni bloqueo. Todo token emitido es
presión vendedora futura. Sin una razón obligatoria para *gastar* o *bloquear*
$COGN, el precio sólo puede bajar por construcción, por muy bonito que sea el
hard cap. **Escasez de oferta no es demanda.**

### 2.6 La demanda está asumida, no demostrada
"Los laboratorios de IA comprarán datos de razonamiento" es una hipótesis. Hoy no
hay ni un comprador, ni un contrato de compra, ni un precio de mercado. El agente
de BNB es lo más cerca que estás de demostrar el canal de compra, y sigue siendo
una demo.

### 2.7 Riesgos operativos del día de la demo
Plan gratuito de Render duerme el servicio (~30 s la primera petición); el RPC
público de Monad limita `eth_getLogs` a 100 bloques; un CID ya usado devuelve 409
(no reutilices la traza del ensayo); el trial de BNB dura 48 h desde que se lanza;
la wallet del oráculo necesita gas.

## 3. La arquitectura que fortalece $COGN

Principio rector: **el token debe ser necesario para que el sistema funcione, no
un premio que se reparte**. Cuatro piezas, en orden de impacto por esfuerzo.

### 3.1 Cerrar el bucle: quien compra datos quema o bloquea $COGN
Hoy: usuario razona → recibe $COGN. Fin. La flecha de vuelta no existe.

Propuesta: el acceso a las trazas verificadas se paga **en $COGN**, y ese pago se
reparte así:
- una parte al autor de la traza (retribución continua, no sólo el mint inicial),
- una parte a los validadores,
- **una parte se quema**.

Con eso, cada dólar de demanda de datos retira oferta circulante. Es la diferencia
entre un token de recompensa y un token de acceso. Implementación mínima: un
contrato `DataAccess` que cobra en $COGN por desbloquear un CID y quema un
porcentaje fijo.

### 3.2 Poner en riesgo capital para poder emitir: staking de validadores
El oráculo único se sustituye por N validadores que **bloquean $COGN** para poder
firmar evaluaciones. Si firman basura y otro validador lo impugna con éxito, se
les recorta el stake (slashing). Esto consigue tres cosas a la vez:
- retira circulante (el stake está bloqueado),
- descentraliza el punto de fallo de la §2.3,
- hace que la calidad del dato tenga coste, que es lo que compra el laboratorio.

Camino gradual y realista: hoy 1 oráculo → siguiente paso un umbral de 2-de-3
firmas con `maxRewardPerMint` bajo → después staking con slashing.

### 3.3 Que el usuario firme lo que reclama (barato, hazlo ya)
El usuario firma con su wallet un mensaje `hash(traza) + nonce` (EIP-712) y el
oráculo verifica la firma antes de emitir. Coste: unas horas. Elimina la §2.2 y
hace que la autoría sea comprobable por cualquiera, que es justo lo que hace
vendible el dato.

### 3.4 Que el CID sea real y que el contenido esté disponible
Pinning efectivo (IPFS vía un pinner, o Arweave si quieres permanencia pagada una
vez) y guardar en el evento el CID real. Sin esto, la §2.4 convierte tu tesis
—"recibo criptográfico que une pago y conocimiento"— en una promesa.

### 3.5 Evaluación en dos niveles (y por qué el stub es defendible hoy)
El score debe ser **determinista y reproducible** porque es dinero: si un LLM
decide la nota, nadie puede auditar la emisión y el propio LLM se convierte en el
oráculo. Arquitectura correcta:

- **Nivel 1, on-chain-relevante**: comprobaciones deterministas y baratas
  (unicidad, longitud mínima, verificabilidad del resultado cuando el problema
  tiene respuesta comprobable — matemáticas, código que compila y pasa tests).
- **Nivel 2, fuera de la ruta del dinero**: modelo que redacta feedback y ordena
  calidad relativa para el *ranking* del mercado de datos, no para el mint.

Y el mejor filtro anti-farmeo no es un modelo más listo: es **exigir problemas con
verificación objetiva** (la respuesta se comprueba). Ahí el bot que rellena
palabras saca 0.

### 3.6 Anti-sybil sin fricción excesiva
Coste por intento (micro-fee en $COGN o en gas, devuelto si la traza supera el
umbral) + límite por identidad, no por wallet. Un coste pequeño destruye la
economía del farmeo masivo sin molestar al usuario legítimo.

## 4. Orden en que yo lo haría

1. Firma del usuario (§3.3) — horas, tapa el agujero más embarazoso.
2. Problemas con verificación objetiva (§3.5) — convierte el scoring en algo defendible.
3. Pinning real del CID (§3.4) — hace verdadera la tesis del recibo.
4. Contrato de acceso a datos con quema (§3.1) — es lo que convierte $COGN en dinero de un mercado.
5. Multi-firma del oráculo y luego staking con slashing (§3.2).
6. Auditoría externa antes de mainnet + Safe multisig.

Los puntos 1-3 son cuestión de una o dos sesiones de trabajo. El 4 es el que
cambia la conversación con un VC, porque responde a "¿por qué el token sube de
valor si el producto tiene éxito?" con mecánica en lugar de con narrativa.

## 5. Qué decir y qué no decir ante los jueces

Decir: hard cap y cubeta de minería verificables, el fundador no puede acuñar,
vesting irrevocable en cadena, cada emisión lleva CID, la misma evaluación es
reproducible en dos cadenas distintas.

No decir: que el scoring es IA, que el CID está en IPFS, que hay multisig, que hay
demanda comprobada. Si un juez lo pregunta, la respuesta correcta es el roadmap de
la §4 — tener identificado el fallo y tener el plan vale más que fingir que no
existe.
