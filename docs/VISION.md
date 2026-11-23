# AICFES — Visión de producto

Escrito el 22 de noviembre de 2026. Este documento existe porque las
ideas que lo originaron se perdieron una vez al comprimirse una
conversación, y porque un plan que vive solo en la memoria de alguien
no es un plan.

Lo que está marcado **verificado** se comprobó contra el código o
contra producción, con el comando al lado. Lo que está marcado
**pendiente** o **sin verificar** es exactamente eso: no construir
sobre ello sin comprobarlo primero.

---

## 1. Qué problema resuelve, de verdad

El ICFES es el examen que decide a qué universidad entra un estudiante
colombiano. Hay decenas de apps que ofrecen preguntas de práctica.

Esta no compite por tener más preguntas. Compite por resolver la razón
real por la que un estudiante que *quiere* estudiar no estudia: **las
redes sociales ganan**.

Esa es la experiencia de Diego en carne propia: perdió oportunidades
por procrastinación, y la procrastinación tenía nombre propio —
Instagram, TikTok. No le faltaba material de estudio. Le faltaba poder
cerrar la otra app.

### La mecánica central: el peaje

El estudiante activa el "modo intensivo" (nombre provisional). Desde
ese momento:

1. Intenta abrir Instagram.
2. En vez de Instagram, aparece una pantalla de AICFES.
3. Le pide resolver **5 ejercicios** — no cualquiera: los de los temas
   donde su propio historial dice que va mal.
4. Si los resuelve, se desbloquea Instagram por **15 minutos**.
5. Pasados los 15 minutos, vuelve a bloquearse.

No es un bloqueador de apps. Es un **peaje cognitivo**: la red social
sigue ahí, pero ahora cuesta algo, y lo que cuesta es exactamente lo
que el estudiante necesitaba hacer.

Esto exige consentimiento explícito, declarado en términos y
condiciones. El estudiante se lo impone a sí mismo. Esa distinción no
es cosmética: es la diferencia entre una herramienta de autocontrol y
un software de vigilancia, y es también lo que decide si las tiendas
la aprueban.

### Por qué los temas débiles y no preguntas al azar

Ya existe la infraestructura para esto: `PerfilDebilidad` guarda, por
usuario, área y tema, cuántas respondió, cuántas acertó y qué tipo de
errores comete. El peaje no es castigo genérico; es la pregunta que a
esa persona le falta.

**Verificado:** `prisma/schema.prisma:190` — modelo `PerfilDebilidad`
con `unique(userId, area, tema)`. `src/time-trial/time-trial.service.ts:212`
— `areaDebil()` y `temaDebil()` ya eligen el área y el tema flojos.

---

## 2. Qué ya funciona hoy

Medido, no recordado.

### El banco de preguntas está lleno

```
curl -s https://aicfes-backend.deviego.xyz/api/items/bank/stats
```

| Área | Verificados | Pide un examen real |
|---|---|---|
| CN | 73 | 58 |
| ING | 69 | 55 |
| MAT | 68 | 50 |
| SOC | 63 | 50 |
| LC | 53 | 41 |
| **Total** | **326** | `simulacroMaximo: 254` |

**El simulacro completo de 254 preguntas funciona hoy.** Las cinco
áreas están por encima de su meta.

Aparte, `ItemReferencia` tiene ~2.600 ítems extraídos de cuadernillos
reales. Eso **no** se sirve al estudiante: es evidencia para generar
preguntas nuevas con sabor a examen real.

### Modos de estudio

| Modo | Estado | Dónde |
|---|---|---|
| Entrenar (5/10/15, por área o mixto) | funciona | `src/app/entrenar.tsx` |
| Contrarreloj (5 modos) | funciona | `src/time-trial/modos.ts:36` |
| Simulacro completo (254) | funciona | `src/simulacro/` |
| Tutor conversacional | funciona | `src/tutoria/` |
| Plan de estudio tras sesión | funciona | `src/feedback/` |
| Pregunta del día (el error que falló) | **backend sin desplegar** | `src/calidad/error-del-dia.service.ts` |

Los cinco modos de contrarreloj, con su nivel y segundos por pregunta:

| id | Límite | Preguntas | s/pregunta | Nivel |
|---|---|---|---|---|
| `calentamiento` | 540 s | 6 | 90 | 1 |
| `ritmo-real` | 512 s | 8 | 64 | 2 |
| `bajo-presion` | 360 s | 8 | 45 | 3 |
| `muerte-subita` | 150 s | 5 | 30 | 4 |
| `simulacro-mixto` | 320 s | 5 | 64 | 2 |

`64` segundos no es arbitrario: es el ritmo del examen real
(`src/time-trial/modos.ts:19`, `SEGUNDOS_EXAMEN_REAL`).

Hay 3 modos retirados que siguen en el código (`modos.ts:103`):
`sprint_10`, `reto_5`, `explosivo`.

### Gamificación: ya existe y ya se ve

Corrijo algo que dije antes en la conversación: la gamificación **no**
falta. Está construida y se pinta en pantalla.

| Pieza | Regla | Dónde |
|---|---|---|
| XP por acierto | 10 XP × multiplicador de dificultad | `dashboard.service.ts:21` |
| XP por minuto | 1 XP | `dashboard.service.ts:22` |
| Multiplicadores | fácil 1 · media 1,3 · alta 1,7 | `dashboard-math.ts:13` |
| Nivel | `floor(xp / 500) + 1` | `dashboard-math.ts:39` |
| Bonus contrarreloj | solo si acierta ≥50 % | `dashboard.service.ts:193` |
| Racha | día válido = 5 min **y** 3 preguntas | `dashboard-math.ts:8` |
| Hitos de racha | 3, 7, 14, 21, 30, 60, 90 | `dashboard-math.ts:11` |
| 5 misiones diarias | 30–80 XP cada una | `dashboard.service.ts:28` |
| Ledger de XP | tabla `XPEvent`, auditable | `schema.prisma:252` |
| 3 logros con progreso | racha 7, 10 sesiones MAT, 5 contrarreloj/semana | `dashboard.service.ts:1093` |

Nivel, XP, racha y misiones se pintan en `src/app/inicio.tsx:62-150`.
Los logros se conectaron hoy (`SeccionLogros`).

**Lo que no existe:** ranking entre usuarios, insignias persistidas,
logros en base de datos (los 3 están escritos a mano en el servicio).

### Calidad y costo

Esto es lo que distingue el proyecto de un envoltorio de ChatGPT:

- Cada pregunta generada se **verifica** con un segundo modelo antes de
  servirse (`src/items/services/verificador-claude.service.ts`).
- Cada llamada al modelo se **contabiliza** en `ConsumoLlm` con su
  costo real en milicents (`schema.prisma:478`).
- La cuota diaria es **por dinero gastado**, no por número de
  preguntas (`src/calidad/cuota.service.ts:53`).
- `embedding vector(1536)` en `GeneratedItem` e `ItemReferencia`: hay
  deduplicación semántica, no solo por hash.

### Tamaño

| | |
|---|---|
| Backend | 79 archivos TypeScript |
| Móvil | 71 archivos, 6.663 líneas |
| Pruebas móvil | 120 pasan |
| Arquitectura | `core → shared → features → app`, verificada por `capas.test.ts` |

---

## 3. El peaje: qué permite cada sistema operativo

**Estado: investigación en curso al momento de escribir esto.**

Esta sección es la que decide si el producto es viable, y es
justamente donde no se puede improvisar. Las reglas de Apple y Google
cambian cada año, y construir dos meses contra una política mal
recordada significa un rechazo de tienda.

Lo que hay que resolver, por plataforma:

### Android — probablemente viable

Mecanismos candidatos, por verificar:

- `SYSTEM_ALERT_WINDOW` — dibujar encima de otras apps.
- `PACKAGE_USAGE_STATS` / `UsageStatsManager` — saber qué app está en
  primer plano.
- `AccessibilityService` — la vía que usan Opal y Jomo. Google Play
  tiene una política específica sobre usarla para algo que no sea
  accesibilidad, y esa política es el riesgo principal.
- `DevicePolicyManager` — más potente, pero cambia la naturaleza de la
  app.

**La pregunta que decide:** ¿aprueba Google Play una app que use
`AccessibilityService` para bloquear apps, y qué declaración exige?

### iOS — VERIFICADO: Apple documenta este caso de uso exacto

Investigado el 22 nov 2026 contra la documentación oficial de Apple.
**El resultado es mejor de lo esperado.**

En iOS 26.4 Apple añadió `secondaryButtonSubmenuItems`, y el ejemplo
que escribe en su propia documentación es literalmente:

> "your app might tailor actions for an education app as: 'Finish this
> lesson.', 'Complete homework.', **'Take a quiz.'**"

Fuente: [secondaryButtonSubmenuItems](https://developer.apple.com/documentation/managedsettingsui/shieldconfiguration/secondarybuttonsubmenuitems)

Esto deja de ser un hack tolerado y pasa a ser el patrón previsto.

Y en iOS 26.5, `ShieldActionResponse.openParentalControlsApp` permite
que el botón del bloqueo **abra tu app**. Es la pieza que faltaba para
que el peaje funcione sin trucos.

**Ya hay apps en App Store con esta mecánica exacta**, lo que prueba
que App Review la aprueba:

| App | Qué hace |
|---|---|
| Math Attack | "Unlock access by answering math questions correctly" |
| BrainGate | Desbloqueo de 5 a 60 min tras ejercicios |
| one sec | Integra LENGO: vocabulario para desbloquear redes |

**Funciona para autorregulación**, no solo control parental:
`FamilyControlsMember.individual` existe desde iOS 16. El usuario se
autoriza a sí mismo con Face ID o Touch ID. No exige Family Sharing,
ni un menor, ni un tutor. Encaja exacto con el opt-in voluntario.

#### Tres límites que cambian el diseño

**1. El bloqueo no renderiza vista propia.** `ShieldConfiguration` es
un struct de campos fijos: icono, título, subtítulo y dos botones. Los
ejercicios van **en la app**, no en la pantalla de bloqueo. El botón
lleva allá.

**2. El bloqueo no tiene red.** Su extensión corre en un sandbox que
*prevents your extension from making network requests*. Todo lo que
muestre debe estar precomputado localmente, en un App Group.

→ **Esto hace el modo offline obligatorio, no opcional.** Las
preguntas del peaje tienen que estar ya en el teléfono.

**3. No se puede nombrar Instagram por código.** El usuario las elige
en el `FamilyActivityPicker` de Apple y la app recibe **tokens
opacos**, por privacidad. No se puede saber desde el servidor qué
bloqueó ni listar las apps instaladas.

#### El trámite, que sigue siendo el camino crítico

- `com.apple.developer.family-controls` **exige revisión de Apple**:
  "Apple reviews your app, and if it's approved, adds the entitlement".
- Lo pide el **Account Holder**, no un miembro del equipo.
- **Hay que pedirlo por cada target**: app + extensiones. Con tres
  extensiones son cuatro solicitudes.
- Aplica también a **TestFlight**, no solo a producción.
- Desarrollo local funciona sin aprobación.
- **Plazo: no publicado.** Apple no declara cuánto tarda. Por eso es
  lo primero que hay que mover.
- Señal de riesgo: todo el lenguaje oficial habla de *parental
  controls*. Conviene encuadrar la solicitud en términos de control de
  uso y bienestar digital, no solo "app de ICFES".

Formulario: `developer.apple.com/contact/request/family-controls-distribution`

#### Una cláusula de App Review que afecta el precio

**4.10** prohíbe monetizar las capacidades del sistema, y nombra las
Screen Time APIs. Se puede cobrar por la preparación del ICFES; **no**
se puede vender "desbloquear apps" como el producto. Es una decisión
de cómo se redacta el plan, no un bloqueo.

#### Módulos para Expo

Dos mantenidos, ambos exigen prebuild y extensiones nativas:

- `kingstinct/react-native-device-activity` — el más maduro (183
  estrellas, MIT). No declara soporte de Expo 58.
- `magrinj/expo-screen-time` — declara "tested on SDK 58".

EAS sí sincroniza la capability (está en su lista de soportadas), pero
sincronizarla no es tenerla aprobada. Screen Time API **no funciona en
simulador**: exige dispositivo físico.

### Android — pendiente de verificar

La investigación sigue en curso. Los mecanismos candidatos
(`SYSTEM_ALERT_WINDOW`, `UsageStatsManager`, `AccessibilityService`) y
sobre todo **la política de Google Play sobre usar
`AccessibilityService` para bloquear apps** son el dato que falta.

### Implicación para Expo

Nada de esto existe en JavaScript. Significa:

- Módulos nativos propios (Kotlin para Android, Swift para iOS).
- Un *config plugin* de Expo por plataforma.
- En iOS, extensiones de app aparte del binario principal.
- **Deja de funcionar en Expo Go.** Obliga a build de desarrollo.

Eso no es un obstáculo, pero sí un cambio de ritmo: cada prueba pasa
por una compilación de EAS, no por recargar el bundle.

---

## 4. Monetización

**Estado: investigación en curso.** Los números concretos de comisión
y de pasarelas colombianas van aquí cuando lleguen verificados.

### Lo que ya está construido

El backend ya distingue planes por **costo diario en dólares**:

| Plan | Tope diario | Variable |
|---|---|---|
| `gratis` | 0,25 USD | `CUOTA_DIARIA_GRATIS_USD` |
| `pago` | 3,00 USD | `CUOTA_DIARIA_PAGO_USD` |
| `semilla` | 10,00 USD | `CUOTA_DIARIA_SEMILLA_USD` |

El tope gratis está puesto cerca de lo que cuesta una sesión de
estudio real (unas 25 preguntas): un estudiante de verdad no lo
alcanza, un script sí en segundos.

**El hueco concreto:** `plan` existe como tipo y como tope, pero
**nadie lo asigna nunca**. Siempre cae en `'gratis'` por omisión
(`cuota.service.ts:94`). El modelo `User` **no tiene campo `plan`**.

Eso es lo primero que hay que construir para cobrar: una columna, un
sitio donde escribirla, y un webhook de la pasarela que la escriba.

**Verificado:** `grep -rn "'pago'" src/ --include='*.ts'` no encuentra
ninguna asignación fuera del propio servicio de cuota.

### La tensión que hay que resolver

Diego quiere cobrar con pasarelas colombianas (Wompi, PayU, Mercado
Pago) para aceptar PSE y Nequi, y para no pagar 15–30 % de comisión a
las tiendas.

Apple y Google restringen cobrar por fuera para contenido digital que
se consume en la app. Las reglas cambiaron tras los litigios de
2024-2025 y hay que confirmar el estado vigente y si aplica en
Colombia.

Preguntas abiertas, por resolver con fuentes oficiales:

1. ¿Qué se permite enlazar o mencionar hoy dentro de la app?
2. ¿Está disponible *User Choice Billing* de Google en Colombia, y con
   qué comisión?
3. ¿Califica una app educativa como *reader app* de Apple?
4. ¿Cuánto queda de una suscripción de 20.000 COP por cada vía?
5. IVA del 19 % en servicios digitales: quién lo retiene según la vía.

---

## 5. Lo que falta, medido

### Cimientos — sin esto el 1.0 se cae

| Qué | Por qué duele | Dónde |
|---|---|---|
| `POST /api/auth/refresh` sin usar | la sesión expira y el estudiante cae al login sin saber por qué | existe en `auth.controller.ts:180` |
| Campo `plan` en `User` | sin él no se puede cobrar | `prisma/schema.prisma:61` |
| Desplegar la pregunta del día | la tarjeta está invisible en producción | sin commitear |
| Figuras sin dibujar | hay preguntas que necesitan gráfico y la app no lo muestra | `figuras/item/:id.svg` existe, nadie lo llama |

### Huecos de calidad

| Qué | Dónde |
|---|---|
| 7 hooks que no exponen su error | simulacro, sesión, feedback |
| `GET /api/simulacro/blueprint` sin usar | el backend lo ofrece |
| 3 modos de contrarreloj retirados en el código | `modos.ts:103` |
| Logros escritos a mano, no en base de datos | `dashboard.service.ts:1093` |

### Para el 1.0 "potente"

| Qué | Depende de |
|---|---|
| El peaje en Android | política de Play sobre `AccessibilityService` |
| El peaje en iOS | entitlement de Apple |
| Pasarela de pagos | decisión de vía (tienda vs. local) |
| Pantalla de planes | campo `plan` + pasarela |
| Ranking / liga | nada; se puede construir ya |
| Insignias persistidas | migración de Prisma |

---

## 5b. El público: jóvenes de 16-18 años

Diego fue parte de este público, y el proyecto nace de su propia
experiencia. Esa intuición vale más que un estudio de mercado, pero hay
cosas que se miden, y tres de ellas están medidas abajo.

Los datos de mercado colombiano (cuántos presentan, precios de la
competencia, gama de teléfono, capacidad de pago) están **en
investigación** al escribir esto. No estimar: verificar.

### Tres huecos que decide este público, medidos hoy

**1. La app no funciona sin internet.**

`expo-secure-store` guarda la sesión y nada más. La caché de
react-query vive en memoria y muere al cerrar la app
(`src/core/http/consultas.ts`): no hay `persistQueryClient`, ni
AsyncStorage, ni SQLite.

Un estudiante en el bus, en un colegio sin WiFi, o con los datos
agotados a mitad de mes, abre la app y no ve nada. Para un plan
prepago eso no es un detalle técnico: es la razón por la que se borra
una app.

Y el APK pesa 94 MB, que ya es una descarga seria con datos medidos.

**Verificado:** `grep -rn "persist\|AsyncStorage" src/core/` sin
resultados fuera de la sesión.

**2. No hay notificaciones. Ninguna.**

`expo-notifications` no está instalado. Tampoco
`expo-background-task`.

Esto choca de frente con lo que ya está construido: hay rachas con
hitos de 3, 7, 14, 21, 30, 60 y 90 días
(`dashboard-math.ts:11`). **Una racha sin notificación se rompe en
silencio** — el estudiante no se enteró de que hoy le faltaba.

El mecanismo de retención está construido a medias: la mitad que
cuenta, sin la mitad que avisa.

Falta también `expo-updates`: hoy, corregir una palabra exige
recompilar y que el usuario actualice desde la tienda.

**Verificado:** ninguna de esas dependencias aparece en
`movil/package.json`.

**3. La app habla de "usted".**

65 cadenas de interfaz, 13 con trato formal:

> "Sabe al instante si acertó, y puede hablar con el tutor cuando no."
> "Suba la escalera a su ritmo."
> "Guardamos su progreso para que no empiece de cero cada vez."

Para alguien de 17 años, el "usted" es como le habla un profesor o un
trámite. El ICFES ya intimida bastante. Una app que te quita Instagram
necesita sonar como alguien de tu lado, no como la rectoría.

Son 13 cadenas: una tarde de trabajo. Es la decisión de producto más
barata con más efecto en cómo se siente el producto.

**Verificado:** conteo sobre `src/**/*.tsx` el 22 nov 2026.

### Lo que hay que entender de ese público, y no está resuelto

- **Quién paga.** Si paga la familia, el argumento de venta es para un
  adulto; si paga el estudiante, el precio tiene que caber en una
  mesada. Son dos productos distintos.
- **Cuándo estudian.** La temporada del ICFES tiene fecha. La demanda
  no es plana.
- **Qué gama de teléfono.** Decide el peso del APK y si vale la pena
  iOS primero.
- **Por qué abandonan.** Una app educativa adolescente se abandona
  rápido; conviene saber si es por aburrimiento, por fricción o por
  falta de resultado visible.

---

## 6. Riesgos, en orden de cuánto pueden costar

1. **Apple niega el entitlement de Family Controls.** Mata la función
   central en iOS. Hay que pedirlo *ya*, antes de construir.
2. **Google Play rechaza el uso de `AccessibilityService`.** Hay vías
   alternativas, pero todas peores.
3. **Las tiendas exigen su propio cobro.** Convierte 20.000 COP en
   14.000–17.000 COP.
4. **El costo del modelo supera lo que paga el usuario.** Ya hay
   contabilidad por usuario (`ConsumoLlm`) para medirlo, pero nadie lo
   está mirando contra el precio de un plan.
5. **Bloquear apps asusta a los padres o a los estudiantes.** El
   consentimiento explícito y los términos claros son parte del
   producto, no papeleo.

---

## 7. Qué hacer primero

El orden lo decide una sola pregunta: *¿qué pasa si esto no funciona?*

1. **Pedir el entitlement de Apple.** Es trámite, no código, y puede
   tardar semanas. Si se niega, todo el plan de iOS cambia. Hacerlo
   antes que nada.
2. **Verificar la política de Google Play.** Misma lógica, sin trámite.
3. **Cimientos:** `auth/refresh`, campo `plan`, desplegar la pregunta
   del día. Son días, no semanas, y sin ellos nada más importa.
4. **Prototipo del peaje en Android.** Es la plataforma permisiva: si
   la mecánica no engancha ahí, no vale construirla en iOS.
5. **Decidir la vía de pago** con los números a la vista.
6. **El resto:** ranking, insignias, figuras, más modos.

---

## Cómo mantener este documento

Cada afirmación lleva su archivo y línea, o el comando que la
comprueba. Cuando algo cambie, cambiar también la línea que lo dice.

Un dato que caduca rápido: el inventario del banco. Se consulta, no se
recuerda:

```
curl -s https://aicfes-backend.deviego.xyz/api/items/bank/stats
```

Lo aprendí a la mala: guardé el inventario de una mañana, lo cité por
la tarde como estado actual, y estaba equivocado.
