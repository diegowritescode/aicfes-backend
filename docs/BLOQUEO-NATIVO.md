# El bloqueo nativo de apps

Lo que hace falta para que el peaje bloquee apps de verdad, y lo que
descubrir eso cambió del diseño.

Investigado el 23 nov 2026 contra el código del módulo (descargado de
npm, no leído en su README) y contra las políticas de Google Play.
Todo lo que lleva cita se comprobó; lo que no, está marcado.

---

## La decisión tomada: validar la mecánica primero

El peaje **ya funciona como pantalla** (`movil/src/app/peaje.tsx`):
cinco preguntas de los temas flojos, sin red, con la cola guardando
las respuestas. Lo que falta es que Android bloquee Instagram.

Eso se pospuso a propósito. Si cinco preguntas por quince minutos no
engancha a un estudiante real, el bloqueo nativo no lo arregla — y
costaría semanas sobre un módulo sin rodaje.

---

## El hallazgo que cambia el producto

**No se puede elegir las apps por código.**

`blockSelection(selectionId: string, options?)` — el parámetro es un
identificador de una selección que **el usuario hizo en un selector
nativo**, no una lista de paquetes
(`expo-screen-time@0.3.0`, `src/ExpoScreenTimeModule.ts:77`).

JavaScript nunca ve nombres de paquete. Es deliberado, por privacidad:
los identificadores son opacos y el módulo advierte "never parse or
construct one in JS".

**Consecuencia:** "bloquear Instagram y TikTok" no se programa. El
estudiante elige sus distractores en una pantalla de Android y la app
recibe un identificador.

Para este producto probablemente es mejor — cada estudiante sabe qué
le distrae — pero cambia el onboarding, que ahora tiene un paso más y
uno que no controlamos.

---

## Los quince minutos no son de reloj

Cita literal del módulo
(`src/ExpoScreenTimeModule.ts:111`):

> "The budget is **usage-based, not wall-clock**: it is only spent
> while a blocked app is actually in the foreground — it pauses when
> the user leaves and resumes when they come back."

Son quince minutos **de uso**. Cerrar Instagram pausa el contador.

Ya está corregido en la pantalla: dice "15 minutos de uso" y explica
que el tiempo corre solo mientras la tenga abierta. Decir "15 minutos"
haría que la app pareciera rota cuando queda tiempo una hora después.

Además, `getRemainingUnlockSeconds()` avanza a saltos de 30 segundos,
así que **no se puede dibujar como una cuenta atrás suave**.

---

## La decisión que ahorra semanas de trámite

El módulo trae `accessibilityEngine` **apagado por omisión**, y su
propia documentación explica por qué: "It changes a consumer's Play
review, so it is not in the library manifest".

| | Apagado (omisión) | Encendido |
|---|---|---|
| Formulario de Play | no | sí |
| Vídeo demo | no | sí, con 7 puntos obligatorios |
| Divulgación prominente | no por esta vía | pantalla propia obligatoria |
| Revisión | normal | "hasta varias semanas" |
| Cubre perfil de trabajo, Private Space, apps clonadas | no | sí |

Y hay un argumento de política a favor de dejarlo apagado: Google
exige "use more narrowly scoped APIs and permissions in lieu of the
Accessibility API when possible". `UsageStatsManager` + overlay **es**
esa alternativa más acotada.

Así que apagado es más fácil y más defendible. Lo que se pierde es
detectar apps abiertas desde un perfil de trabajo o Private Space.

---

## Dos límites que no se negocian

**En Android el bloqueo es fricción, no cárcel.** El propio módulo lo
dice en una tabla titulada "iOS and Android, honestly": en Android el
usuario lo apaga desde Ajustes. `getEnforcementGaps()` lo reporta pero
no lo evita, y `getCapabilities()` devuelve `blocking: "friction"`.

Eso coincide con la decisión ya tomada: diseñar para fricción, no para
imposibilidad.

**Impedir la desinstalación es la línea roja.** La política de Play lo
permite solo "authorized by a parent or guardian through a parental
control app or by authorized administrators through enterprise
management software". Para autocontrol de un estudiante no hay
excepción.

El módulo ofrece un paso `deviceAdmin` que hace exactamente eso. **No
usarlo** salvo que se monte un flujo de padre o tutor, que es otro
producto.

Bloquear el *acceso* a una app sí está permitido. Lo prohibido es
impedir *desinstalar*.

---

## El riesgo del módulo

| | |
|---|---|
| Repo creado | 13 nov 2026 (10 días) |
| Versiones en npm | 0.1.1 y 0.3.0 |
| Descargas última semana | **74** |
| Issues reportados | **cero, nunca** |

Cero issues con los issues habilitados no es señal de calidad: es
señal de que no hay usuarios. Los bugs se encontrarán de primera mano.

Lo que compensa en parte: el código es serio. ~90 archivos Kotlin, ~45
suites de pruebas unitarias, pruebas de fuzzing, Maestro para
extremo a extremo, y aserciones que fijan la forma exacta del
manifest. Es un proyecto nuevo y bien hecho, no uno abandonado.

Compatibilidad verificada: declara `expo ~58.0.25` y
`react-native 0.88.1`, que es exactamente lo que este proyecto tiene.

---

## Lo que NO hay que hacer

**No correr `npx expo prebuild`.** EAS Build lo corre en la nube, y
generar `android/` localmente **desactiva ese paso**: desde entonces
los campos nativos de `app.json` dejan de aplicarse al binario hasta
que alguien vuelva a correr prebuild a mano.

Y `movil/.gitignore` **no lista `/android`**, así que un prebuild
accidental se commitea.

Para instalar el módulo basta añadirlo a `plugins` en `app.json` y
correr `eas build`.

Otro dato verificado contra el binario de `@expo/cli@58.1.21`: desde
SDK 57 `expo prebuild` **limpia por omisión** y `--no-clean` es la vía
incremental. La documentación de Expo sobre CNG sigue describiendo el
comportamiento anterior.

---

## Qué haría falta cuando se decida construirlo

En orden, y el primero es el que decide si vale la pena:

1. **Un development build de prueba** solo para comprobar que el
   módulo hace lo que dice en un teléfono real: permisos, selector,
   bloqueo, desbloqueo temporal.
2. El onboarding de permisos. Son varios pasos, uno por pantalla del
   sistema, y el módulo los expone de a uno
   (`requestScreenTimePermissionsAsync` con `step`).
3. El selector nativo de apps (`<ActivityPicker>`), que es donde el
   estudiante elige qué bloquear.
4. Conectar el botón del escudo a la ruta `/peaje`, que ya existe.
5. `drainShieldInteractions()` al volver al frente, para saber cuántas
   veces intentó abrir algo bloqueado. Nota: registra **reacciones al
   escudo**, no aperturas, y solo se lee cuando la app vuelve al
   primer plano.

---

## Lo no verificado

- Si una app de autorrestricción califica para la excepción de control
  parental. No hay texto de Google al respecto.
- Si Advanced Protection en Android 17 restringe accesibilidad para
  apps con `isAccessibilityTool="false"`. Lo documenta AppBlock, no se
  confirmó en fuente de Google.
- El texto exacto de las pantallas de divulgación de Forest, AppBlock,
  ScreenZen y Stay Focused: vive dentro del APK y nadie publica
  capturas. Lo que sí se verificó es el texto de sus fichas de Play, y
  es sorprendentemente flojo — AppBlock tiene 10M+ instalaciones con
  una sola frase de marketing.
