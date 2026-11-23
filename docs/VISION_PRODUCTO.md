# Visión de producto

Dónde va AICFES y por qué. Escrito para quien tenga que construir
cualquiera de estas piezas más adelante, incluido el Diego de dentro de
seis meses.

Cada idea lleva lo que cuesta, lo que la bloquea y qué habría que
decidir antes de empezar. Una idea sin su coste no es una decisión, es
un deseo.

---

## El problema real

El fundador hizo el ICFES en julio de 2026. Tenía 1.118 PDFs de
material oficial, comprados para estudiar él mismo. En año y medio
resolvió **tres ejercicios**, contados con la mano. Se inscribió a un
preicfes presencial y tampoco.

No le faltó material. Le faltó fricción en el momento exacto de abrir
Instagram.

Eso define el producto: no es una biblioteca de ejercicios, es lo que
hace que un joven de 17 años resuelva el ejercicio hoy en vez de
mañana. El contenido ya está resuelto; el hábito no.

---

## 1. El modal de tutoría — **hecho** (nov 2026)

En producción, de punta a punta.

**Endpoints** (todos bajo sesión):
`POST /api/tutoria/:itemId/abrir`, `/defensa`, `/mensaje`, `/resuelto`,
`GET /api/tutoria/:itemId`.

**Medido en producción, no estimado:**
- La apertura tarda **1 segundo y cuesta 0**: usa la explicación por
  opción que el ítem ya traía.
- Un turno de conversación cuesta **USD 0.0018**.
- Probado contra el estudiante que pide la respuesta directamente y
  contra el que finge rendirse. En ambos se negó y siguió guiando con
  preguntas.

**Cómo quedó el flujo:** falla → el panel ofrece "No entiendo por qué"
→ el modal pide la defensa → responde con la explicación ya escrita →
conversan hasta 6 turnos → "Volver a intentar" devuelve a la misma
pregunta con las opciones vivas.

**La primera respuesta se conserva y sigue contando.** Lo que el
estudiante sabía antes de la explicación es la medida honesta;
sobrescribirla haría que el perfil se leyera mejor que el estudiante.
Acertar después se registra aparte: "lo sacó tras explicárselo" es
distinto de "lo sabía".

**Verificado en producción:** el hilo sobrevive entre intentos — 6
mensajes y la defensa original intactos al volver a la pregunta.

### Diseño original

### Qué es

Cuando el estudiante falla una pregunta en modo entrenamiento, no pasa
a la siguiente. Se abre un modal que:

1. Le pide **que defienda su respuesta** antes de decirle nada.
2. Le muestra en qué falló su razonamiento, no solo cuál era la
   correcta.
3. Permite conversar sobre **esa pregunta y ninguna otra**.
4. Lo devuelve a **la misma pregunta** para reintentarla.
5. Si vuelve a fallar, **conserva la conversación anterior** y responde
   sabiendo lo que ya se habló.

### Por qué la defensa primero es la mejor parte de la idea

No por lo técnico. Obliga a verbalizar el razonamiento, que es
exactamente donde está el error. Marcar la opción C no dice nada;
escribir "porque multipliqué 60 por 4" dice todo.

Y deja un dato que ningún competidor tiene: **el texto de cómo razonó
mal**, no sólo qué opción marcó. Ese texto es lo que alimenta el perfil
de debilidades de la sección 2.

### Coste: medido, no estimado

Precios reales, medidos contra producción (ver `CostosService`):

| Modelo | Tutoría/mes | Generación/mes | Total |
|---|---|---|---|
| gpt-5-nano | $0.04 | $1.70 | **$1.74** |
| gpt-5-mini | $0.19 | $1.70 | **$1.89** |
| gpt-5 | $0.96 | $1.70 | $2.66 |

Supuestos: 20 sesiones al mes, 10 preguntas cada una, 40% de error,
3 turnos de conversación por fallo.

**La tutoría no es el problema de costes. La generación cuesta nueve
veces más.** Con 2.427 ítems oficiales ya cargados, servir del banco en
vez de generar es el ahorro grande; el modal es ruido en la factura.

### El primer mensaje es gratis

El banco ya guarda, por cada ítem, una explicación de **cada opción** y
el tipo de error que representa:

```json
"explicaciones": {
  "A": "❌ Incorrecta porque presenta el costo de las cajas pequeñas…",
  "B": "✅ Correcta porque al calcular cajas, tarimas y sumar…"
},
"distractores": {
  "A": "error_calculo", "B": "correcta",
  "C": "interpretacion_parcial", "D": "confunde_conceptos"
}
```

Eso se escribe una sola vez, al generar el ítem. Así que la primera
respuesta del modal **no necesita llamar a ningún modelo**: ya está
escrita. El modelo entra sólo cuando el estudiante responde a eso.

Corta alrededor del 40% de las llamadas y hace que el modal abra
instantáneo, que importa más que el dinero: un modal que tarda tres
segundos en decir algo se cierra sin leerse.

### Límites que hay que poner

- **6 turnos por pregunta.** Más que eso no es tutoría, es
  conversación. Al sexto, el modal ofrece reintentar.
- **Una pregunta a la vez.** La conversación muere al pasar de ítem.
- **Cuenta contra la cuota diaria** (ver `CuotaService`), con su propio
  precio por turno.
- **El modelo no puede dar la respuesta.** Hay que probarlo: un
  estudiante que descubre que puede sacarle la letra al tutor deja de
  pensar. El prompt lo prohíbe y hace falta un test que lo verifique.

### Qué falta decidir

- ¿El reintento cuenta como acierto si lo logra en el segundo intento?
  Propuesta: se registra aparte, "acertó tras tutoría", que es una
  señal distinta de "acertó".
- ¿La defensa es obligatoria o se puede saltar? Propuesta: obligatoria
  la primera vez, opcional al reintentar.

---

## 2. Perfil de debilidades — **construido** (nov 2026)

Está en producción. Lo que sigue describe lo que quedó hecho y lo que
aún no.

### Qué quedó funcionando

`PerfilDebilidad`: una fila por estudiante, área y tema, contando
respuestas, aciertos y cuántas veces apareció cada tipo de error.
`DebilidadesService.temasDebiles()` devuelve los temas por prioridad y
`areaPrioritaria()` dice qué área poner delante.

La cadena estaba rota en tres puntos, y cada uno hacía inútil al
siguiente:

1. La API nunca devolvía el id del ítem guardado, así que el cliente no
   tenía qué mandar de vuelta.
2. El cliente no enviaba `itemId`, así que el filtro del servidor
   descartaba todas las respuestas.
3. `createAnswers` aceptaba `itemId` en su schema y lo tiraba al
   insertar.

Por eso `GeneratedItem.vecesRespondido` estaba en cero en los 22 ítems
mientras se registraban respuestas reales: la medición de calidad
llevaba tiempo cableada y nunca había recibido nada.

Verificado en producción: dos respuestas erradas produjeron seis temas
con su tipo de error, y la calidad del ítem pasó de 0 a 2 filas.

### Reglas que lo mantienen honesto

- **Cuatro respuestas mínimo** por tema antes de que cuente. Dos
  fallos de tres no son evidencia.
- **`areaPrioritaria` devuelve null** hasta tener datos suficientes: a
  un estudiante nuevo no se le empuja a ningún lado.
- **Una debilidad vieja pesa menos.** Lo que alguien falló en marzo no
  debe superar lo de la semana pasada.
- El mínimo de muestra está **en el servicio además de en la consulta**.
  Sólo en SQL, la regla es invisible para quien lee el código — lo
  descubrió una prueba.

### Lo que falta

Nada de esto *usa* el perfil todavía. Queda:

- Que las misiones diarias salgan de las debilidades en vez de la lista
  fija de cinco.
- ~~Que contrarreloj sortee con sesgo hacia lo flojo.~~ Hecho.
- ~~"El error del día".~~ Hecho.
- Que el plan del feedback deje de ser genérico.

### Qué era (diseño original)

Que la plataforma aprenda en qué falla cada estudiante, y no al nivel
grueso de "va mal en Sociales", sino fino: ángulos, la segunda ley de
Newton, inferencia textual.

Y que eso **dirija** qué se le pone delante. Si alguien domina
Matemáticas y falla Sociales, ponerle Sociales todos los días no es
castigo, es el método.

### Lo que ya existe y no se está usando

El campo `distractores` clasifica cada opción por **tipo de error**:
`error_calculo`, `interpretacion_parcial`, `confunde_conceptos`. Y
`tags` lleva el tema concreto.

Hoy se generan y se tiran. Guardando qué tipo de error cometió el
estudiante, en qué tema, ya se tiene el micro-análisis sin inventar
nada nuevo. Esto es recolección, no investigación.

### Cómo se usaría

- **Las misiones diarias** se arman desde las debilidades, no desde una
  lista fija de cinco.
- **Contrarreloj** sortea con sesgo hacia lo flojo.
- **"El error del día"** (sección 4) sale de aquí.
- **El plan de estudio** del feedback deja de ser genérico.

### Cuidado

Un perfil construido con pocos datos miente. Con tres preguntas de
Sociales respondidas, dos falladas, el sistema diría "66% de debilidad
en Sociales", que no significa nada. Hace falta un mínimo de
observaciones antes de actuar sobre un tema — el mismo criterio que ya
se usa en el análisis psicométrico del banco: nada por debajo de 20
respuestas es señal.

---

## 3. El overlay de bloqueo (proyecto aparte)

### Qué es

App móvil que, con permiso explícito del usuario, detecta cuándo abre
Instagram, TikTok, X o Reddit y pone una pantalla encima: "resuelve 5
ejercicios para desbloquear 15 minutos". Los ejercicios salen de su
plan de estudio.

Modos: **tranquilo** (sin overlay), **estricto**, **intensivo**. Se
elige en ajustes.

### Viabilidad técnica, por plataforma

**Android: sí.** `UsageStatsManager` dice qué app está en primer plano,
`SYSTEM_ALERT_WINDOW` dibuja encima. Es como funcionan Opal, Forest y
ActionDash.

**iOS: no así.** Apple no permite dibujar sobre otra app. Pero
`FamilyControls` + `ManagedSettings` (iOS 16+) permiten **bloquear**
apps por categoría, y `DeviceActivityMonitor` dispara al cruzar un
umbral. No se pone una pantalla encima de Instagram: se hace que
Instagram no abra hasta resolver los ejercicios. Mismo efecto, camino
distinto, y hay que diseñar las dos experiencias por separado.

### El riesgo que puede tumbar la app

**Google Play.** Las políticas de *Accessibility API* y de overlay han
tumbado apps así. Opal y Forest sobreviven porque usan
`UsageStatsManager` (no accesibilidad) y porque el permiso lo activa el
usuario a mano desde Ajustes. Hay que seguir ese camino exacto.

### Salida de emergencia: obligatoria

Si alguien necesita WhatsApp por una urgencia real y la app lo bloquea,
eso es un problema serio, no una anécdota.

Modelo Opal: escape que cuesta pero existe. **60 segundos de espera,
queda registrado, se puede usar.** Mantiene la fricción sin volverse
peligroso. Esto no es negociable y va desde la primera versión.

### Menores de edad

El público son estudiantes de 16 a 18 años. Una app que bloquea apps en
el teléfono de un menor toca:

- **Ley 1581 de 2012** (Colombia): datos personales de menores exigen
  tratamiento especial.
- **COPPA** (EE.UU.): aplica bajo 13 años; probablemente fuera del
  público, pero hay que verificarlo antes de publicar allí.
- **Google Play Families** y **App Store Kids**: políticas propias y más
  estrictas.

Hace falta: términos explícitos, consentimiento verificable para el
modo estricto en menores, y revisión legal antes de publicar. Qustodio
vive de esto, así que se puede; no se improvisa.

**Esto es un proyecto aparte**, no una funcionalidad. App nativa,
permisos, políticas de dos tiendas y asunto legal de menores.

---

## 4. Minijuegos

Pensados para jóvenes estresados, que es el estado por defecto de
alguien a meses del ICFES.

### Vale la pena

**Duelos 1v1 asíncronos** — **backend hecho** (23 nov 2026). Retas a
un compañero, ambos resuelven las mismas 5 preguntas cuando puedan.
Es lo que hizo crecer a Duolingo. Social sin la presión de estar en
vivo.

**Gana quien acierta más; el tiempo solo desempata.** Al revés
enseñaría a responder rápido y mal, y el ICFES da 64 segundos por
pregunta justamente porque hay que pensarlas. Empate exacto es
empate: inventar un desempate decidiría el duelo por algo que ninguno
hizo mejor.

**Cómo se encuentran: alias buscable** (ADR 32). Era la decisión más
delicada del producto, porque el público es de 16-18 y lo que permite
que un estudiante encuentre a otro permite que un adulto encuentre a
uno de ellos. Por eso en la **misma migración** entraron bloqueo y
denuncia: una versión con búsqueda y sin bloqueo es una ventana en la
que un menor acosado no puede defenderse.

La autorización del acudiente (Ley 1581 de 2012) **condiciona la
búsqueda, no la cuenta**: sin ella la app funciona entera —entrenar,
simulacros, el peaje, repasar errores— y uno simplemente no aparece.
Y "bloqueado" y "no buscable" le dicen lo mismo al estudiante, para
que un bloqueado no pueda deducir quién lo bloqueó.

Las preguntas salen del banco y **viajan sin la respuesta**: es el
único lugar del producto donde el estudiante tiene motivo para
mentir sobre su propio puntaje.

**La cola de denuncias ya se puede leer** (ADR 33, 23 nov 2026). Era
la obligación abierta del punto anterior: un botón de denuncia que
nadie atiende es peor que no tenerlo, porque promete algo que no
llega. Hay cola ordenada por antigüedad —la que lleva tres días
esperando es la que le falló a quien la mandó— y cada fila dice
**cuántas personas distintas** denunciaron esa cuenta, porque tres
quejas de una persona y una de tres personas se ven iguales en un
total y no son lo mismo.

La acción es **sacar de búsqueda, no borrar**: el estudiante conserva
cuenta, historial y nombre, y deja de ser encontrable. Borrarle la
cuenta a un menor por una denuncia que nadie verificó no es una
decisión para automatizar, y ser invisible corta el acoso igual,
porque todo duelo empieza con una búsqueda.

Se entra con un secreto puesto en el servidor por SSH, no con un rol
en la base: la fila que da el permiso viviría en la misma base que se
está moderando. **Sin ese secreto configurado la cola queda cerrada**,
no abierta — lo contrario filtraría en silencio una cola de denuncias
de menores.

**Lo que todavía falta:** alguien tiene que acordarse de mirar. Hay un
`GET /moderacion/pendientes` que responde en una petición si la cola
está siendo atendida, pero nada lo pregunta solo y nadie recibe
aviso. Una cola legible y sin leer es apenas un paso mejor que una
cola ilegible.

**Racha con perdón** — **hecho** (23 nov 2026). Una racha que se rompe
a los 30 días destruye la motivación en vez de construirla; Duolingo
vende "streak freeze" por eso. Un perdón gratis al mes convierte el
fracaso en algo recuperable.

Verificado en producción: tres días estudiados saltándose ayer dan
racha de 3, donde antes daban 1. Y la pantalla lo dice — "Te
perdonamos un día" — porque un estudiante que sabe que faltó ayer y ve
la racha intacta concluiría que el número está mal.

**"El error del día"** — **hecho** (nov 2026). Una pregunta diaria
tomada de lo que el estudiante ya falló, en la tarjeta del dashboard,
por encima de las estadísticas: los números describen el pasado, esto
son los próximos treinta segundos.

Es lo único aquí que **no cuesta nada**: la pregunta ya existe, ya
tiene su explicación y se pagó cuando se generó.

Orden de preferencia: una que falló y no ha vuelto a acertar, luego
cualquiera de su tema más flojo, luego **nada**. A un estudiante sin
historial no se le muestra tarjeta — una pregunta al azar rotulada
"su error de hoy" es una mentira que descubre al primer vistazo.

Verificado en producción: el usuario con fallos recibió una de las
suyas sin la clave de respuesta; el usuario nuevo recibió `null`.

`GET /api/error-del-dia?timeZone=America/Bogota`

**Contrarreloj con progresión real** — **hecho** (nov 2026). Los tres
modos viejos daban 60s por pregunta cada uno, así que no había
escalera: el examen real da 64s, con lo que el modo más duro era más
fácil que el examen. Ahora son cinco niveles anclados a ese número —
Calentamiento 90s, Ritmo real 64s, Bajo presión 45s, Muerte súbita
30s, Las cinco áreas 64s — y ninguno fija un área: todos preguntan al
perfil de debilidades. Verificado en producción: un usuario que falló
Matemáticas recibió 7 preguntas de Matemáticas.

Desde el 23 nov 2026 **las preguntas salen del banco** y solo se
generan las que falten (ADR 31). Una ronda de ocho eran ocho
peticiones al modelo por preguntas que ya existían, y "Las cinco
áreas" hacía cinco llamadas **en secuencia** — ahí estaba toda la
lentitud. En un modo cuyo punto es el ritmo, repetir una pregunta
cuesta poco; `draw` ordena por `lastServedAt`, así que la repetida es
siempre la más vieja que vio. Entrenar sigue generando, que es donde
la novedad se paga sola.

### No vale la pena

**Ranking global.** Con estudiantes estresados, ver que eres el #4.200
desmotiva. Si hay ranking, que sea contra uno mismo de la semana
pasada, o en una liga de diez.

**Liga de diez** — descartada el 23 nov 2026. Aparecía arriba como la
salida decente al ranking, y la evidencia la tumbó: Hadi Mogavi 2022
(L@S, sobre Duolingo) describe cómo la competitividad y el *herding*
desplazan el foco del aprendizaje, y el meta-análisis Li/Ma/Shi 2023
da gamificación en línea en g = 0,340 con el cero dentro del
intervalo, con el efecto cayendo a g = 0,01 en edades mayores. Costaba
tabla nueva y agrupación semanal para el minijuego de peor relación
valor/costo de la lista.

**"Modo última hora"** — descartado el 23 nov 2026, y conviene decir
de dónde salió: lo propuso Claude en sesión, no estaba en esta visión.
Era barato (un modo más en la escalera de contrarreloj) y eso fue
justo el argumento sospechoso: barato no es lo mismo que valioso. La
escalera ya tiene cinco niveles anclados al ritmo real del examen; un
sexto nivel no le enseña nada nuevo a nadie.

**Vidas o corazones.** Castigar el error en una app de estudio es
contraproducente. El error es el dato más valioso que tenemos: es lo
que alimenta el perfil de debilidades.

---

## 5. Pagos

**No todavía, y no por lo técnico.**

A noviembre de 2026 el único usuario real es el fundador, con 2
sesiones. Integrar Wompi o Mercado Pago son 2-3 días, pero después hay
que mantener webhooks, reembolsos y facturación para nadie.

La parte difícil ya está hecha: `CuotaService` limita gasto por usuario
y por día, con planes `gratis` y `pago` ya diferenciados. El día que
haya demanda, conectar la pasarela es cambiar el plan de un usuario.

**Disparador para retomarlo:** usuarios reales que choquen con la cuota
gratuita de forma recurrente. Eso es demanda; lo demás es suponer.

---

## Orden sugerido

1. ~~**Perfil de debilidades**~~ — hecho (nov 2026).
2. ~~**Contrarreloj rediseñado**~~ — hecho (nov 2026). Primer consumidor
   del perfil.
3. ~~**Modal de tutoría**~~ — hecho (nov 2026), de punta a punta.
4. ~~**"El error del día"**~~ — hecho (nov 2026). **Racha con perdón**
   sigue pendiente.
5. **Duelos** — cuando haya usuarios que duelar.
6. **Overlay** — proyecto aparte, con su propio plan legal.
7. **Pagos** — cuando la cuota gratuita moleste a gente real.

---

## Lo que ya está resuelto

Para no reconstruirlo por olvido:

- **Banco de referencia**: 2.427 ítems oficiales, 865 con su texto base.
- **Generación con RAG**: cada pregunta se escribe mirando 4 ítems
  reales del banco.
- **Verificación cruzada**: un modelo distinto resuelve el ítem antes de
  aceptarlo.
- **Cuota diaria por usuario**, en dinero y no en preguntas.
- **Autenticación cerrada** en los endpoints que gastan.
- **Gamificación funcionando**: XP, niveles, racha y 5 misiones diarias
  que se completan solas. Está sin usar, que no es lo mismo que estar
  rota.
- **Registro de costes por petición** (`ConsumoLlm`), que es de donde
  salen los números de este documento.
- **Perfil de debilidades por tema y tipo de error**, alimentado desde
  cada respuesta.
- **Tutoría por pregunta fallada**, con la defensa del estudiante
  guardada y el hilo conservado entre intentos.
- **Gasto atribuido a cada usuario**, que es lo que hace que la cuota
  diaria limite de verdad. Durante un tiempo no lo hacía: 55 registros
  de costo sin dueño y una cuota que leía cero para todos.
- **Calidad de ítem medida con respuestas reales**, que es lo que
  distingue una pregunta difícil de una mal escrita.

---

# Investigación verificada (22 nov 2026)

Todo lo que sigue se comprobó contra fuentes primarias — documentación
oficial, PDFs del ICFES y del DANE, fichas de Play Store una por una —
no contra resúmenes. Lo que no se pudo verificar está marcado como
tal, y conviene leer esas marcas: alguna decide si una vía es viable.

Dos hallazgos corrigen cosas que este documento daba por supuestas, y
están señalados donde corresponde.

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

### Android — VERIFICADO: posible, con tres correcciones al plan

Investigado el 22 nov 2026 contra developer.android.com y las
políticas de Google Play.

**Android no tiene ninguna API de bloqueo.** Se construye combinando
tres cosas: detección (`UsageStatsManager` o `AccessibilityService`),
overlay (`SYSTEM_ALERT_WINDOW`) y un foreground service.

Las 7 apps vivas que se verificaron en Play usan `AccessibilityService`:
Forest, AppBlock, ScreenZen, Stay Focused, BlockSite, ActionDash,
StayFree. Ninguna evidencia de sanción.

#### Tres correcciones a lo que asumíamos

**1. Opal y Jomo no existen en Android.** Se probaron seis nombres de
paquete: todos 404. Son solo iOS y usan la Screen Time API de Apple.
El patrón de referencia en Android es Forest / AppBlock / ScreenZen,
no ellos.

**2. Los términos y condiciones NO bastan.** Esto contradice el plan
original. La política de Play exige, textualmente, que la divulgación:

> "Must be within the app itself, cannot only be in the app
> description or on a website; Must be displayed in the normal usage
> of the app... Cannot only be placed in a privacy policy or terms of
> service; and Cannot be included with other disclosures pertaining to
> personal or sensitive data collection."

Es decir: **pantalla propia, en el flujo normal, con aceptación
afirmativa.** Más un formulario aprobado en Play Console y un **vídeo
demo** que muestre el flujo de consentimiento *y el de rechazo*.

Fuente: [support.google.com/googleplay/android-developer/answer/10964491](https://support.google.com/googleplay/android-developer/answer/10964491)

**3. El bloqueo nunca será irrompible, y la política prohíbe
intentarlo.** El usuario puede desactivar la accesibilidad en Ajustes
en cualquier momento. La política prohíbe "prevent the ability for
users to disable or uninstall any app or service unless authorized by
a parent or guardian".

→ **Diseñar para fricción, no para imposibilidad.** Eso encaja con la
idea: el peaje no encierra a nadie, pone el estudio en el camino.

#### Lo que sí está permitido

Bloquear apps **no** está prohibido. Lo prohibido es impedir que el
usuario se salga, y la "autonomía" (decisiones que la app toma sola).
Un bloqueador por reglas cae del lado permitido: Google aclara que
"This does not prohibit deterministic, rule-based automation, where
behavior follows a static, human-defined script".

`SYSTEM_ALERT_WINDOW` y `PACKAGE_USAGE_STATS` no tienen restricción de
publicación. Solo `AccessibilityService` exige la declaración.

#### Límites y trampas

| Qué | Detalle |
|---|---|
| `isAccessibilityTool` | Debe ser `false`. Una app de examen no califica como herramienta de accesibilidad |
| Android 15+ | Para arrancar el foreground service hace falta **overlay ya visible**. Orden obligatorio |
| Permisos | Overlay, usage access y accesibilidad se conceden en **tres pantallas del sistema**. Tres viajes a Ajustes en el onboarding |
| Imposible | Matar otra app, modo kiosco (exige device owner y reset de fábrica), bloquear una web dentro del navegador sin accesibilidad |
| EAS Update | No se puede entregar por OTA un cambio que altere el comportamiento declarado de la accesibilidad |

#### Módulo para Expo

`expo-screen-time` (el mismo que para iOS) cubre Android: declara
`PACKAGE_USAGE_STATS`, `SYSTEM_ALERT_WINDOW`,
`FOREGROUND_SERVICE_SPECIAL_USE`, una `ShieldActivity`, y hasta un
`PipEvictorActivity` contra el escape por picture-in-picture. La
accesibilidad es **opt-in** por flag.

Riesgo: 40 estrellas, repo de hace días, 10 issues abiertos. Es joven.

Casi todo lo demás que se buscó está muerto o no existe:
`react-native-system-alert-window`, `react-native-android-usage-stats`,
`react-native-device-policy-manager` no existen en npm.

**Un punto sin resolver:** si el carve-out de control parental cubre el
autobloqueo voluntario. No hay resolución pública. Decide si se puede
usar un `DeviceAdminReceiver` anti-desinstalación.

---

## 4. Monetización

Investigado el 22 nov 2026. **Hay un dato que condiciona todo y que
sigue SIN VERIFICAR de primera mano** — está marcado abajo.

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

### El dato que condiciona todo (SIN VERIFICAR de primera mano)

La investigación reporta que las salidas legales para cobrar por fuera
**son por mercado, y Colombia no está en ninguna**:

- **Apple:** la excepción que permite enlazar a pago externo aplicaría
  solo al storefront de **Estados Unidos**. En el storefront
  colombiano seguiría prohibido poner links, botones o precios que
  lleven a pagar fuera de la app (guidelines 3.1.1(a) y 3.1.3).
- **Google Play:** el programa de pago alternativo existiría solo en
  Australia, Japón, Reino Unido y el EEE. **Colombia no.**

El storefront lo decide el país de la cuenta del usuario, no dónde
esté el desarrollador. Usuario colombiano = regla restrictiva.

> **Esta afirmación no se verificó contra las guidelines de Apple ni
> contra la ayuda de Play Console directamente.** Es lo más caro de
> todo el análisis: decide si se puede cobrar con Wompi o si toca la
> tienda. **Confirmarlo antes de construir la pasarela.**

### Las comisiones reales, si toca la tienda

Mejores de lo que se temía: **15 %, no 30 %**, en ambas.

- Apple: Small Business Program, 15 % si se facturó ≤ 1 millón USD el
  año anterior.
- Google Play: las suscripciones auto-renovables son 15 % sin importar
  el volumen.

### Las pasarelas colombianas, comparadas

De una suscripción de **20.000 COP**, asumiendo no responsable de IVA:

| Vía | Neto | % |
|---|---|---|
| Wompi | **18.536** | 92,7 % |
| PayU / Rapyd | 18.860 | 94,3 % |
| dLocal Go | 18.574 | 92,9 % |
| Mercado Pago (14 días) | 18.384 | 91,9 % |
| **Apple / Google al 15 %** | **17.000** | **85,0 %** |

**Diferencia Wompi vs tienda: 1.536 COP por suscripción, 7,7 puntos.**
Con 1.000 suscriptores al mes son ~18,4 millones COP al año.

**Wompi es la recomendación**, por tres razones concretas:

1. Tarifa 2,65 % + 700 COP, la más baja con recurrencia.
2. **El único con recurrencia documentada en Nequi** (tokenizado),
   Botón Bancolombia y Daviplata. Decisivo: mucho estudiante de 16-18
   no tiene tarjeta de crédito.
3. Registro como **persona natural sin Cámara de Comercio**.

Trampas detectadas: DaviPay cobra 73.400 COP/mes aparte por
suscripciones — con 50 suscriptores sale **peor que la tienda**. PSE
probablemente no es auto-debitable, así que no sirve para cobro
recurrente.

### El patrón legal: app de solo login

Es lo que hacen Netflix (desde 2018) y Spotify (desde 2016): la app
iOS **solo tiene login**, sin precios ni enlaces de compra. Fuera de
la app, la comunicación sí está permitida: "Developers can send
communications outside of the app to their user base about purchasing
methods other than in-app purchase."

Para AICFES eso significa adquisición **web-first**: el estudiante
llega por TikTok o Google, paga en la web con Wompi, descarga la app y
entra con su cuenta.

**Riesgo honesto:** Netflix y Spotify sobreviven con app de solo login
porque son marcas enormes. Una app nueva y pequeña tiene riesgo real
de rechazo pidiendo IAP. Mitigación: ofrecer también la compra en la
tienda a un precio más alto (26.900 en tienda vs 20.000 en web) y
absorber el 15 % de quien compre ahí.

### Impuestos: la variable de mayor impacto

Probablemente el servicio **esté gravado** con IVA al 19 %: la
exclusión del Art. 476 cubre establecimientos educativos reconocidos
por el Gobierno, y una app privada no lo es.

Pero probablemente Diego sea **no responsable de IVA**, por el umbral
de 3.500 UVT (≈183 millones COP al año en 2026).

Eso importa mucho: si resulta responsable y no puede subir el precio,
el neto por Wompi cae a **15.343 COP (76,7 %)** y la ventaja sobre la
tienda casi desaparece.

**Dos preguntas para un contador**, no para mí:
1. ¿Está gravado el servicio, y aplica el umbral de 3.500 UVT?
2. ¿Qué CIIU corresponde para el régimen SIMPLE? Educación cae en el
   grupo del 5,9 %–14,5 %, el más caro. La diferencia con el grupo de
   comercio es ~4 puntos del ingreso bruto.

### RevenueCat: no, por ahora

Gratis hasta 2.500 USD de ingreso mensual, luego 1 %. Existe para
orquestar las compras de Apple y Google. Si se cobra por Wompi no
aporta nada y cuesta 1 % extra. Solo tendría sentido sosteniendo
tienda y web en paralelo.

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
(`aicfes-frontend/movil/src/core/http/consultas.ts`): no hay
`persistQueryClient`, ni
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

---

## 7. El plan: de aquí al 1.0

Seis bloques. El orden lo decide una pregunta: *¿qué pasa si esto no
funciona?* Lo que puede invalidar meses de trabajo va primero, aunque
sea aburrido.

### Bloque 0 — Esta semana: trámites y la fuga

Nada de esto es código interesante, y todo bloquea algo grande.

| Qué | Por qué ahora |
|---|---|
| **Desplegar la corrección de seguridad** | `/api/items/requests/failed` está abierto en producción y filtra respuestas correctas. Verificado el 22 nov |
| **Pedir el entitlement de Apple** | Trámite humano sin plazo publicado. Son 4 solicitudes (app + 3 extensiones) y las pide el titular de la cuenta. Si lo niegan, el plan de iOS cambia entero |
| **Verificar la regla de pagos** | Leer las guidelines 3.1.1(a) y 3.1.3 y la ayuda de Play. Decide Wompi vs tienda. Una tarde |
| **Hablar con un contador** | IVA y CIIU. Dos preguntas, y mueven ~4 puntos del ingreso |

### Bloque 1 — Cimientos (1 semana)

Sin esto nada más importa, y es todo pequeño.

- `POST /api/auth/refresh` en el móvil. Hoy la sesión expira y el
  estudiante cae al login sin saber por qué.
- Columna `plan` en `User`, con su migración. Es la primera pieza para
  poder cobrar: hoy `plan` existe como tipo pero nadie lo asigna.
- Desplegar la pregunta del día (ya está escrita).
- Los 7 hooks que no exponen su error.

### Bloque 2 — Offline (1-2 semanas)

**Dejó de ser opcional.** La pantalla de bloqueo de Apple corre en un
sandbox sin red: las preguntas del peaje tienen que estar ya en el
teléfono. Y hoy la app sin internet está vacía.

- Persistir la caché de react-query (AsyncStorage o SQLite).
- Descargar un lote de preguntas por adelantado, elegidas por los
  temas débiles del estudiante.
- Cola de respuestas pendientes que se sincroniza al volver la red.
- Bajar el APK de 94 MB.

Esto sirve dos veces: hace la app usable con datos prepago **y** es
requisito del peaje.

### Bloque 3 — Notificaciones (3-5 días)

Hay rachas con hitos de 3, 7, 14, 21, 30, 60 y 90 días, y ninguna
forma de avisar. Una racha sin notificación se rompe en silencio.

- `expo-notifications`, con recordatorio a una hora que el estudiante
  elija.
- Avisar cuando la racha está por romperse, no después.
- `expo-updates`, para corregir sin pasar por la tienda.

### Bloque 4 — El peaje (3-4 semanas, Android primero)

Android primero porque es la plataforma permisiva: si la mecánica no
engancha ahí, no vale construirla en iOS.

1. Pantalla de divulgación propia, con aceptación explícita. **No en
   los términos y condiciones** — Play lo prohíbe expresamente.
2. Onboarding de los tres permisos, con sus tres viajes a Ajustes.
3. Detección de app en primer plano y overlay con el peaje.
4. Los 5 ejercicios de temas débiles, servidos desde el lote local.
5. Desbloqueo de 15 minutos y re-bloqueo al terminar.
6. Formulario de Play Console y vídeo demo.

Luego iOS, con el entitlement ya en mano: el shield abre la app
(`openParentalControlsApp`) y los ejercicios ocurren adentro.

### Bloque 5 — Cobrar (1-2 semanas)

Depende de lo que diga el bloque 0.

- Wompi con recurrencia (Nequi y tarjeta), si la regla lo permite.
- Webhook que escriba la columna `plan`.
- Landing de pago, fuera de la app.
- Pantalla de planes dentro de la app **sin precios ni enlaces**, si
  toca la vía restrictiva.

Cuidado con App Review 4.10: se cobra por la preparación del ICFES,
nunca por "desbloquear apps".

### Lo que queda para después del 1.0

Ranking entre estudiantes, insignias persistidas, figuras en las
preguntas (`figuras/item/:id.svg` existe y nadie lo llama), los 3
modos de contrarreloj retirados, `simulacro/blueprint`.

### Y la deuda de escalabilidad

Una auditoría del 22 nov encontró cosas que no rompen hoy con pocos
usuarios pero sí con mil. Las que valen la pena antes de cobrar:

| Problema | Dónde |
|---|---|
| `scryptSync` bloquea el event loop en cada login | `auth.service.ts:15` |
| Login sin límite de intentos | `auth.controller.ts:141` |
| Rate limiter en memoria, no sobrevive a dos réplicas | `items.controller.ts:31` |
| `getAchievements` carga **todas** las sesiones del usuario | `dashboard.service.ts:1099` |
| La generación corre dentro de la petición HTTP, sin cola | `items.controller.ts:160` |
| `/health` no toca la base de datos | `health.controller.ts:27` |
| Sin endpoint para borrar la cuenta | relevante con menores de edad |

Esa auditoría no se verificó entera: de sus tres acusaciones más
graves, **una era real y dos eran falsas**. Comprobar antes de
arreglar.

---

## Cómo mantener esto

Cada afirmación lleva su archivo y línea, o el comando que la
comprueba. Cuando algo cambie, cambiar también la línea que lo dice.

Un dato que caduca en horas: el inventario del banco. Se consulta, no
se recuerda:

```
curl -s https://aicfes-backend.deviego.xyz/api/items/bank/stats
```

Lo aprendí a la mala: guardé el inventario de una mañana, lo cité por
la tarde como estado actual, y estaba equivocado.

Y antes de escribir un documento nuevo en `docs/`, mirar qué hay.
Este archivo recibió un duplicado por no haberlo hecho.
