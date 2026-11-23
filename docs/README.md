# Documentación de AICFES

## Por dónde empezar

| Si quieres… | Lee |
|---|---|
| entender el producto y hacia dónde va | [VISION_PRODUCTO.md](VISION_PRODUCTO.md) |
| entender cómo está construido | [ARQUITECTURA.md](ARQUITECTURA.md) |
| escribir una consulta o una migración | [MODELO-DE-DATOS.md](MODELO-DE-DATOS.md) |
| desplegar, o entender el servidor | [INFRAESTRUCTURA.md](INFRAESTRUCTURA.md) |
| saber por qué algo es como es | [adr/](adr/) |
| arrancar el proyecto | [../README.md](../README.md) |

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

Del 11 al 18 son **retroactivos**: decisiones que se tomaron en el
código y nunca se escribieron. Se recuperaron del historial de commits
y de los comentarios, y cada afirmación se verificó contra el archivo
antes de registrarla.

**Quedan ~12 por escribir**, ninguna de las más costosas. Entre ellas:
la escalera del contrarreloj anclada a 64 segundos (está explicada en
`modos.ts` y en VISION_PRODUCTO), el loader que indexa por hash del
enunciado, los encabezados de seguridad del frontend estático, y que
la medición vive en su propio módulo para evitar un ciclo entre
`items` y `dashboard`.

**Dos huecos que no se pudieron documentar:** no hay rastro en el
historial de por qué NestJS, y el rechazo de Capacitor no aparece en
ningún commit ni comentario de ninguno de los dos repos. Si esas
decisiones se tomaron en una conversación, la razón se perdió.

## Por área

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
