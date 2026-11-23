# Validar el peaje con estudiantes reales

Qué poner delante de alguien, qué mirar, y qué decidir después.

Escrito el 23 nov 2026, cuando el peaje funciona como pantalla y el
bloqueo nativo de apps todavía no existe. Eso es deliberado: si cinco
preguntas por quince minutos no engancha, el bloqueo no lo arregla —
y construirlo cuesta semanas sobre un módulo con 74 descargas
semanales y ningún issue reportado jamás.

---

## Qué está listo para probar

El APK de `preview` apunta a producción, así que lo que el estudiante
haga cuenta de verdad: su XP, su racha, su perfil de debilidades.

| Pieza | Estado |
|---|---|
| Entrar, registrarse | funciona |
| Entrenar (5/10/15, por área o mixto) | funciona |
| Contrarreloj, 5 modos | funciona |
| Simulacro de 254 preguntas | funciona |
| Tutor conversacional | funciona |
| Pregunta del día | funciona |
| **El peaje**, desde "Modo intensivo" | funciona, **sin bloquear apps** |
| Lote offline | funciona |
| Recordatorio diario | funciona |
| Desglose del XP | funciona |

Lo que **no** hace: bloquear Instagram. El estudiante entra al peaje
porque toca una tarjeta, no porque la app se lo imponga.

---

## Lo que hay que mirar

En orden de cuánto cambia la decisión.

### 1. ¿Leen la explicación o la saltan?

**La pregunta que más importa.** El peaje no exige acertar — se
desbloquea respondiendo. Toda la carga educativa está en la
explicación que aparece después de cada respuesta.

Si la saltan, el peaje interrumpe sin enseñar, y entonces es una
molestia con buena intención. Si la leen, la mecánica funciona y vale
construir el bloqueo.

Cómo medirlo sin preguntar: mirar cuánto tardan entre responder y
tocar "Siguiente". Menos de dos segundos es saltar.

### 2. ¿Lo abren por su cuenta?

Sin bloqueo nativo, abrir el peaje es voluntario, lo que lo hace una
prueba más dura que la real: nadie lo está obligando.

Si alguien lo abre dos veces sin que se lo pidan, la mecánica tiene
algo. Si solo lo abren cuando se les pide, el valor venía del bloqueo
y no del peaje.

### 3. ¿Cinco preguntas se sienten justas?

Demasiadas y lo evitan. Demasiado pocas y no enseña nada. La cifra es
ajustable (`POR_BLOQUE` en
`movil/src/features/offline/model/lote.ts`).

Lo que conviene preguntar al final, no durante: *¿fueron muchas,
pocas, o estuvo bien?*

### 4. ¿Entienden qué es el "modo intensivo"?

El nombre es provisional. Si nadie sabe qué esperar al tocarlo, el
problema es de nombre y de copy, no de mecánica.

---

## Lo que NO hay que preguntar

**"¿Te gustaría que la app te bloqueara Instagram?"** Todo el mundo
dice que sí a una idea así en abstracto y mucha menos gente lo usa.
La pregunta útil no es si les gusta la idea, es si resolvieron las
cinco preguntas cuando nadie los obligaba.

**"¿Usarías esto?"** Un sí no cuesta nada. Lo que vale es lo que
hicieron, no lo que dicen que harían.

---

## Cuántos, y quiénes

Tres a cinco personas que **de verdad vayan a presentar el ICFES**. No
sirven amigos ni familia haciendo un favor: un favor produce
cumplidos, no datos.

Con cinco personas se ve si la explicación se lee o no. No se ve
retención —para eso hacen falta semanas— y conviene no fingir que sí.

---

## Lo que ya se sabe y no hay que volver a medir

De la investigación del 22-23 nov, con fuentes primarias:

- **44% de los adolescentes abandona una app de hábito diario en la
  primera semana**, y los predictores de quedarse fueron
  autorregulación y narrativa. El chatbot no predijo nada (Maenhout
  2022, n=186, con registros de uso reales).
- **La gamificación no es un gancho medido en apps**: g = 0,340 con
  intervalo que incluye el cero en aprendizaje en línea, y el efecto
  cae con la edad.
- **El feedback informativo sí**: d = +0,33.

Por eso el peaje —que es autorregulación— es el activo defendible, y
por eso la explicación después de cada respuesta importa más que el
XP.

---

## Después

**Si leen la explicación y vuelven solos:** vale construir el bloqueo
nativo. Ver [BLOQUEO-NATIVO.md](BLOQUEO-NATIVO.md) para lo que
cuesta, incluido que las apps las elige el usuario en un selector
nativo y no el código.

**Si la saltan:** el problema es la explicación, no el bloqueo. Más
corta, más concreta, o en otro momento. Arreglarlo cuesta días;
construir el bloqueo cuesta semanas.

**Si no lo abren solos:** la mecánica necesitaba el bloqueo para
existir. Eso no la mata, pero sube el riesgo: habría que construir
semanas de código nativo sin señal previa de que engancha.
