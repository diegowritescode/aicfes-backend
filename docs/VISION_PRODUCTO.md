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

## 1. El modal de tutoría (prioridad alta)

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

## 2. Perfil de debilidades (prioridad alta)

### Qué es

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

**Duelos 1v1 asíncronos.** Retas a un compañero, ambos resuelven las
mismas 5 preguntas cuando puedan, gana el de mejor tiempo + aciertos.
Es lo que hizo crecer a Duolingo. Social sin la presión de estar en
vivo.

**Racha con perdón.** Una racha que se rompe a los 30 días destruye la
motivación en vez de construirla; Duolingo vende "streak freeze" por
eso. Un perdón gratis al mes convierte el fracaso en algo recuperable.
*Ya existe `streak` en el dashboard; falta el perdón.*

**"El error del día".** Una sola pregunta diaria, tomada de lo que el
estudiante ya falló. Treinta segundos. Es el hábito más barato de
sostener y es exactamente lo que el ICFES premia: no repetir tu propio
error. Depende de la sección 2.

**Contrarreloj con progresión real.** Hoy los tres modos dan 60s por
pregunta, así que no hay progresión ni presión: el examen real da ~64s.
Debería escalar 90s → 64s → 45s, con nombres que signifiquen algo.

### No vale la pena

**Ranking global.** Con estudiantes estresados, ver que eres el #4.200
desmotiva. Si hay ranking, que sea contra uno mismo de la semana
pasada, o en una liga de diez.

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

1. **Contrarreloj rediseñado** — mejora algo que existe y funciona.
2. **Perfil de debilidades** — recolección, casi todo el dato ya se
   genera.
3. **Modal de tutoría** — depende de 2 para ser útil de verdad.
4. **"El error del día" y racha con perdón** — dependen de 2.
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
