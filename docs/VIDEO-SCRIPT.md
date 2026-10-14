# Guion de video para Monad

Duración objetivo: 5–7 minutos. La narración debe sonar técnica pero simple:
mostrar una economía real de contribución, no sólo un token.

## Estructura de una frase

```text
CalchAI convierte razonamiento humano verificable en un activo de datos recompensado con $COGN en Monad.
```

## Guion escena por escena

### 1. Apertura — problema y propuesta (30 segundos)

**En pantalla:** título del proyecto, logo si existe, nombre CalchAI.

**Narración:**

> “Los modelos de IA necesitan datos de razonamiento humano de calidad, pero hoy
> esas contribuciones no tienen procedencia, autoría ni una forma clara de ser
> recompensadas. CalchAI propone un mercado de Proof of Reasoning: una persona
> explica cómo resolvió un problema, firma esa contribución y, si la evaluación
> es válida, recibe $COGN con un recibo auditable en Monad.”

### 2. Arquitectura en una imagen (45 segundos)

**En pantalla:** diagrama simple o el diagrama de `docs/FLOWS.md`.

**Narración:**

> “El flujo tiene cinco piezas: la dApp, la wallet del usuario, el oráculo, el
> token $COGN y la bóveda de vesting. El usuario no paga gas para reclamar: firma
> un mensaje EIP-712. El backend verifica autoría, problema, respuesta, calidad,
> límites de emisión y duplicados. Sólo después de esas comprobaciones llama al
> contrato para emitir una recompensa.”

**Qué decir si preguntan por el oráculo:**

> “Hoy el oráculo es un evaluador único para que el MVP sea auditable. La capa
> futura introduce múltiples validadores, staking y slashing.”

### 3. Demo del usuario (60–90 segundos)

**En pantalla:** dApp pública y una wallet de testnet.

Pasos a grabar:

1. Abrir `https://dist-zyczpjct.devinapps.com`.
2. Conectar wallet en Monad Testnet.
3. Seleccionar un problema verificable, por ejemplo `trains`.
4. Escribir una traza que use los datos del enunciado.
5. Firmar el typed data.
6. Enviar `/evaluate`.
7. Mostrar score, recompensa, estado de pinning y enlace al explorer.

**Narración:**

> “Aquí el usuario produce una traza, firma la reclamación y recibe una
> recompensa. La firma no sólo apunta a la wallet: también une el hash exacto de
> la traza, el problema, la respuesta, el nonce, la red y el contrato. Si alguien
> modifica uno de esos datos, la firma ya no sirve.”

### 4. Evidencia on-chain (45 segundos)

**En pantalla:** Monad Explorer y contrato del token.

**Narración:**

> “Cada recompensa queda registrada con un evento y un CID. El contrato impone
> un cap total de mil millones de COGN, una reserva de minería de cuatrocientos
> millones, un límite por recompensa y la regla de que un mismo CID no cobra dos
> veces. La quema de tokens tampoco reabre la reserva de minería.”

Enlaces útiles:

```text
Token:
https://testnet.monadexplorer.com/address/0x3721E5c3162FEA106ddC42baBAcEF09664EF625F

Recompensa verificada:
https://testnet.monadexplorer.com/tx/0xd6313f7737b40b231f4621cc6f4a25ad56160e74a91adadadcdada5411ffcaa9
```

### 5. Fallas encontradas y cómo se resolvieron (60 segundos)

**En pantalla:** una tabla o puntos cortos.

**Narración:**

> “El desarrollo reveló tres problemas importantes. Primero, una recompensa
> podía pedirse en nombre de otra wallet; se resolvió exigiendo firma EIP-712 del
> beneficiario. Segundo, bastaba pegar una respuesta correcta sobre una traza
> ajena; ahora la traza debe usar los datos del enunciado y llegar a la respuesta.
> Tercero, el CID podía presentarse como IPFS aunque sólo fuera un hash local;
> ahora la API marca explícitamente si fue pineado o si usa fallback.”

**Detalle técnico opcional:**

> “También se corrigió el orden de evaluación: el CID se calcula antes del
> cooldown para que una traza duplicada devuelva `409` de forma estable, y la UI
> muestra el motivo real del rechazo.”

### 6. Valor del token y del negocio (60 segundos)

**En pantalla:** diagrama productor → protocolo → comprador.

**Narración:**

> “COGN no se presenta como una promesa de rendimiento. Su función actual es
> recompensar contribuciones verificables. El valor económico aparece cuando los
> compradores de datos pagan por acceder a trazas útiles: una parte puede ir al
> productor, otra a validadores y otra a tesorería o quema. Así se cierra el
> ciclo: el usuario produce datos, el comprador consume datos y el token coordina
> el intercambio.”

### 7. Escalabilidad y roadmap (45–60 segundos)

**En pantalla:** tres capas.

**Narración:**

> “La primera capa ya existe: recompensa, firma, evaluación objetiva y límites.
> La segunda capa es el producto de datos: catálogo, licencias, pago en COGN y
> reparto automático. La tercera capa descentraliza la evaluación con staking,
> slashing, múltiples oráculos y multisig. La parte difícil no es emitir tokens:
> es medir calidad, proteger privacidad y encontrar compradores reales.”

### 8. Cierre (15 segundos)

**Narración:**

> “CalchAI ya demuestra en Monad que una traza firmada puede convertirse en una
> recompensa auditable. El siguiente paso es conectar esa producción con demanda
> real de datos de razonamiento.”

## Banco de frases útiles

- “El usuario no recibe tokens por escribir texto; recibe tokens por una
  contribución firmada, evaluada y limitada por contrato.”
- “La firma prueba autoría; el CID prueba qué contenido se evaluó; el evento de
  Monad prueba qué se recompensó.”
- “El hard cap controla la oferta, pero la demanda debe venir de compradores de
  datos. Por eso lo tratamos como roadmap, no como algo ya probado.”
- “El MVP usa un oráculo único para auditar con claridad; la arquitectura futura
  distribuye ese poder con staking y slashing.”
- “Una respuesta correcta no basta: la traza tiene que trabajar con los datos
  del problema.”

## Preguntas difíciles y respuestas

### ¿Qué impide que un bot mine todo?

> “Hoy hay firma del beneficiario, verificación objetiva, cooldown, presupuesto
> diario, tope por mint y deduplicación. Eso no elimina todos los ataques sybil;
> por eso el roadmap añade problemas rotativos, reputación, validadores y staking.”

### ¿Por qué vale COGN?

> “Por utilidad esperada dentro del mercado: recompensa y medio de pago para
> acceso a datos. Todavía no afirmamos ingresos ni retorno para holders; primero
> hay que conectar compradores reales.”

### ¿Por qué Monad?

> “Porque necesitamos finalidad rápida, costos bajos y un entorno EVM para que la
> emisión, los eventos y la exploración on-chain sean prácticos para una demo y
> para producto.”

### ¿Qué es lo más débil del sistema?

> “La validación semántica general. Un problema matemático puede verificarse;
> un razonamiento abierto no siempre puede calificarse de forma objetiva. Por
> eso el diseño prioriza tareas verificables y documenta el límite.”

## Checklist de grabación

- [ ] Usar una wallet de testnet, nunca una wallet principal.
- [ ] Mostrar la dirección pública, no claves ni seed phrases.
- [ ] Ensayar el problema antes de grabar.
- [ ] Tener el explorer abierto en otra pestaña.
- [ ] Mostrar una transacción existente aunque una nueva falle por cooldown.
- [ ] Decir “fallback determinista” si `cidPinned` aparece como `false`.
- [ ] No afirmar IPFS real si no hay `PINATA_JWT` o gateway configurado.
- [ ] No afirmar que el acceso pagado a datos ya está desplegado.
- [ ] Terminar con el link del repositorio público.
