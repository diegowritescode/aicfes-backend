# Documentación de AICFES

## Por dónde empezar

| Si quieres… | Lee |
|---|---|
| entender el producto y hacia dónde va | [VISION_PRODUCTO.md](VISION_PRODUCTO.md) |
| entender cómo está construido | [ARQUITECTURA.md](ARQUITECTURA.md) |
| escribir una consulta o una migración | [MODELO-DE-DATOS.md](MODELO-DE-DATOS.md) |
| desplegar, o entender el servidor | [INFRAESTRUCTURA.md](INFRAESTRUCTURA.md) |
| atender una denuncia de un estudiante | [MODERACION.md](MODERACION.md) |
| saber por qué algo es como es | [adr/](adr/) |
| arrancar el proyecto | [../README.md](../README.md) |

## Qué funciona hoy

Al **23 de noviembre de 2026**. Cada línea se comprobó contra
producción o contra un servidor corriendo, no contra el código.

| | Estado |
|---|---|
| Entrenar, simulacro, repasar errores | en producción |
| Contrarreloj | del banco, **0,5-0,6 s y sin costo** por ronda |
| Racha con perdón de un día | en producción, y la pantalla lo dice |
| Duelos 1v1 asíncronos | backend y móvil, **sin estudiantes reales todavía** |
| Alias, bloqueo y denuncia | en producción |
| Cola de moderación | leíble desde el teléfono; cerrada sin su secreto |
| El peaje dentro de la app | funciona |
| El bloqueo de apps en Android | módulo probado en un teléfono, **sin integrar** |
| Pagos | no existen, y es deliberado |

**Pruebas:** 294 en el backend, 340 en el móvil.

**Banco de preguntas:** 331 ítems verificados (53 LC, 68 MAT, 68 SOC,
73 CN, 69 ING), suficientes para un simulacro completo de 254. El
número sube solo cuando se generan preguntas nuevas — consúltelo con
`GET /api/items/bank/stats` en vez de confiar en esta línea.

**Lo que falta y tiene a alguien esperando del otro lado:** las
denuncias se pueden leer, pero nadie recibe aviso con la app cerrada
(ADR 33). Y el peaje no se ha puesto delante de ningún estudiante real
— [VALIDAR-EL-PEAJE.md](VALIDAR-EL-PEAJE.md) dice cómo hacerlo y qué
mirar.

## Las decisiones (ADR)

Un ADR registra una decisión: qué problema había, qué alternativas se
descartaron y con qué consecuencias se vive. **No se editan cuando algo
cambia** — se escribe uno nuevo que reemplace al anterior, porque el
valor está en saber qué se pensaba entonces.

| # | Decisión |
|---|---|
| [1](adr/0001-validate-model-output-instead-of-trusting-it.md) | Validar la salida del modelo en vez de confiar en ella |
| [2](adr/0002-migrations-are-the-source-of-truth.md) | Las migraciones son la fuente de verdad del esquema |
| [3](adr/0003-stateless-api-with-refresh-tokens.md) | API sin estado, con tokens de renovación guardados |
| [4](adr/0004-the-model-proposes-the-system-decides.md) | El modelo propone, el sistema decide |
| [5](adr/0005-practice-sittings-mirror-the-real-exam.md) | Los simulacros son espejo del examen real |
| [6](adr/0006-figures-are-drawn-from-parameters.md) | Las figuras se dibujan desde parámetros |
| [7](adr/0007-a-native-client-holds-its-own-refresh-token.md) | Un cliente nativo guarda su propio token de renovación |
| [8](adr/0008-the-client-renews-before-it-reports-a-lost-session.md) | El cliente renueva antes de reportar sesión perdida |
| [9](adr/0009-every-route-that-spends-or-reveals-requires-a-session.md) | Toda ruta que gasta o revela exige sesión |
| [10](adr/0010-informative-feedback-over-rewards-for-finishing.md) | Feedback informativo sobre premios por completar |
| [11](adr/0011-failures-lean-toward-the-learner-except-on-correctness.md) | Los fallos se inclinan a favor del estudiante, salvo en corrección |
| [12](adr/0012-costs-are-integers-and-round-against-us.md) | Los costos son enteros y redondean en nuestra contra |
| [13](adr/0013-the-cap-is-money-not-questions.md) | El tope es dinero, no preguntas |
| [14](adr/0014-the-exam-clock-belongs-to-the-server.md) | El reloj del examen es del servidor |
| [15](adr/0015-the-verifier-comes-from-another-model-family.md) | El verificador es de otra familia de modelos |
| [16](adr/0016-generated-from-real-booklets-never-from-memory.md) | Se genera desde cuadernillos reales, no desde la memoria del modelo |
| [17](adr/0017-the-tutor-explains-first-and-never-gives-the-letter.md) | El tutor explica primero y nunca da la letra |
| [18](adr/0018-android-first-and-ios-later.md) | Android primero, iOS después |
| [19](adr/0019-the-bank-is-reused-not-regenerated.md) | El banco se reutiliza, no se regenera |
| [20](adr/0020-item-quality-is-measured-with-real-answers.md) | La calidad del ítem se mide con respuestas reales |
| [21](adr/0021-training-and-sittings-are-separate-features.md) | Entrenar y simular son features separadas, no un flag |
| [22](adr/0022-no-verdict-on-too-little-data.md) | Sin veredicto con pocos datos |
| [23](adr/0023-the-schema-constrains-the-model-not-the-prompt.md) | El esquema restringe al modelo, no el prompt |
| [24](adr/0024-deploys-roll-back-by-changing-a-tag.md) | El despliegue se revierte cambiando una etiqueta |
| [25](adr/0025-the-contrarreloj-ladder-is-anchored-to-the-real-exams-pace.md) | La escalera del contrarreloj está anclada al ritmo del examen real |
| [26](adr/0026-a-reference-item-is-identified-by-its-stem.md) | Un ítem de referencia se identifica por su enunciado |
| [27](adr/0027-measurement-lives-in-its-own-module.md) | La medición vive en su propio módulo |
| [28](adr/0028-cost-is-recorded-after-the-answer-is-sent.md) | El costo se registra después de enviar la respuesta |
| [29](adr/0029-the-dashboard-streams-with-polling-as-the-fallback.md) | El panel se sirve por SSE, con sondeo de respaldo |
| [30](adr/0030-the-web-client-is-a-static-bundle-with-headers-per-location.md) | El cliente web es un bundle estático, con encabezados por location |
| [31](adr/0031-contrarreloj-draws-from-the-bank-entrenar-generates.md) | Contrarreloj saca del banco, entrenar genera |
| [32](adr/0032-duels-are-found-by-alias-with-moderation-in-the-same-migration.md) | Los duelos se buscan por alias, con moderación en la misma migración |
| [33](adr/0033-the-moderation-queue-is-read-with-a-server-side-secret.md) | La cola de moderación se lee con un secreto del servidor |

Del 11 al 18 y del 25 al 30 son **retroactivos**: decisiones que se
tomaron en el código y nunca se escribieron. Se recuperaron del
historial de commits y de los comentarios, y cada afirmación se
verificó contra el archivo antes de registrarla.

**Quedan ~6 por escribir**, ninguna de las más costosas.

El 30 documenta código del **otro repositorio** (`aicfes-frontend`,
rama `main`): sus referencias de archivo y línea son de allá, no de
aquí.

**Dos huecos que no se pudieron documentar:** no hay rastro en el
historial de por qué NestJS, y el rechazo de Capacitor no aparece en
ningún commit ni comentario de ninguno de los dos repos. Si esas
decisiones se tomaron en una conversación, la razón se perdió.

## Por área

**El peaje (la función central)**
- [VALIDAR-EL-PEAJE.md](VALIDAR-EL-PEAJE.md) — qué poner delante de un
  estudiante, qué mirar y qué decidir después; incluye qué NO preguntar
- [BLOQUEO-NATIVO.md](BLOQUEO-NATIVO.md) — qué hace falta para bloquear
  apps de verdad, con el código del módulo verificado y las políticas
  de Play; incluye por qué las apps las elige el usuario y no el código

**Los duelos y la seguridad de los menores**
- [MODERACION.md](MODERACION.md) — cómo leer y atender la cola de
  denuncias, con el secreto que hay que poner en el servidor primero;
  incluye por qué la cola queda cerrada si falta y qué distingue tres
  quejas de una persona de una de tres personas

**El producto y el mercado**
- [VISION_PRODUCTO.md](VISION_PRODUCTO.md) — el problema real, cada
  feature con su coste, la investigación verificada de plataformas y
  pagos, y el plan hacia el 1.0
- [INVESTIGACION-MERCADO.md](INVESTIGACION-MERCADO.md) — datos del ICFES,
  el DANE y la competencia, con sus fuentes

**La API**
- [API.md](API.md) — catálogo de endpoints ⚠️ *incompleto: anterior a
  auth, tutoria, figuras, simulacro y time-trial*
- [API_DEEPDIVE.md](API_DEEPDIVE.md) — visión técnica
- [SESSION_FLOW.md](SESSION_FLOW.md) — start, heartbeat, complete
- [FEEDBACK.md](FEEDBACK.md) — el plan de estudio
- [TIME_TRIAL.md](TIME_TRIAL.md) — contrarreloj
- [GENERACION_MIXTA.md](GENERACION_MIXTA.md) — mezcla por áreas
- [DASHBOARD_SSE.md](DASHBOARD_SSE.md) — el panel en vivo
- [AREA_SUMMARY_COMPLETION.md](AREA_SUMMARY_COMPLETION.md) — resumen por área

**Las preguntas**
- [figuras-plan.md](figuras-plan.md) — catálogo de plantillas SVG
  ⚠️ *es un plan; 6 de 12 construidas*
- [figuras-conteo.md](figuras-conteo.md) — cuántas figuras hay en los
  cuadernillos reales
- [../scripts/README.md](../scripts/README.md) — extraer y cargar el
  banco de referencia

**Operación**
- [INFRAESTRUCTURA.md](INFRAESTRUCTURA.md) — compose, variables, runbook
- [SCALAR_SETUP.md](SCALAR_SETUP.md) — documentación de la API
  ⚠️ *el título dice Scalar; el contenido es Swagger*
- [HARDENING_COMPLETE.md](HARDENING_COMPLETE.md) — endurecimiento
  ⚠️ *dice "completado" sin fecha de verificación*
- [README-detallado.md](README-detallado.md) — README largo
  ⚠️ *tiene secciones duplicadas*

## Histórico

[historico/](historico/) guarda documentos de trabajo ya terminado. Se
conservan porque explican por qué algo quedó como quedó, y están
aparte porque **no describen el estado actual**.

## Cómo mantener esto

**Cada afirmación lleva su archivo y línea, o el comando que la
comprueba.** Cuando el código cambie, cambiar también la línea que lo
dice.

Hay datos que caducan en horas. El inventario del banco se consulta, no
se recuerda:

```bash
curl -s https://aicfes-backend.deviego.xyz/api/items/bank/stats
```

**Antes de crear un documento nuevo, mirar qué hay.** Este directorio
recibió un `VISION.md` duplicado por no haberlo hecho.

Y un documento que dice "COMPLETADO" sin decir cuándo se verificó es un
documento que nadie puede creer. Mejor poner la fecha.
