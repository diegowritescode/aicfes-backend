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

## Verificado en un build real (23 nov 2026)

El módulo **compila** con Expo 58 y React Native 0.88. Primera
pregunta contestada: el módulo de diez días construye.

El APK de desarrollo pesa **271 MB** contra los 95 MB del de
producción. Es normal — un development build trae el cliente de
desarrollo y símbolos — pero conviene no confundirlos al instalar.

Permisos que el módulo trae en su propio manifest, leídos del APK:

| Permiso | Está | Nota |
|---|---|---|
| `PACKAGE_USAGE_STATS` | sí | detectar qué app está delante |
| `SYSTEM_ALERT_WINDOW` | sí | dibujar el overlay |
| `FOREGROUND_SERVICE` | sí | y su variante `SPECIAL_USE` |
| `RECEIVE_BOOT_COMPLETED` | sí | sobrevivir a un reinicio |
| `BIND_ACCESSIBILITY_SERVICE` | **no** | el default deja fuera el trámite de Play |
| `QUERY_ALL_PACKAGES` | **no** | Play lo restringe; el módulo usa `<queries>` acotado |
| `BIND_DEVICE_ADMIN` | **sí** | ver abajo |

### El device admin que no pedimos

El módulo declara **siempre** un receptor de device admin, con este
comentario en su manifest:

> "Device admin with no policy: an active admin cannot be force-stopped
> from Settings and must be deactivated before the app can be
> uninstalled"

Eso es justo lo que la política de Play permite solo *"authorized by a
parent or guardian through a parental control app"*. No hay opción del
plugin para quitarlo.

**El matiz que lo salva:** declararlo no es activarlo. El paso
`deviceAdmin` es `required = false` salvo para `appRemovalProtection`
o un perfil de menor
(`PermissionSteps.kt:24`). Mientras el onboarding no lo pida, el
receptor existe y nunca se activa.

**Lo que esto obliga:**

1. El onboarding **no debe pedir** el paso `deviceAdmin`.
2. Si Play pregunta por el permiso declarado, la respuesta honesta es
   que viene de una dependencia y la app no lo usa.
3. Si algún día se quiere protección contra desinstalación, eso es
   otro producto: hace falta flujo de padre o tutor.

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

## Probado en un teléfono real (23 nov 2026)

Primera prueba del módulo fuera del emulador, en el Xiaomi de Diego
con un APK `preview`. Lo que se comprobó y lo que salió mal.

**Funciona:** el módulo responde `capacidades` con
`blocking: "friction"`, `applications: true`, `shieldOpenApp:
"direct"` y un tope de **19 actividades vigiladas**
(`maxMonitoredActivities`). Los permisos se piden de verdad y de a
uno: `overlay` pasó de `undetermined` a `granted`, y después
`usageAccess`. O sea, el camino de permisos es real en Android.

**La trampa que nadie documenta, y nos va a pegar al validar:**
Android 13+ **bloquea el "Acceso de uso"** para apps instaladas por
fuera de Play Store. El sistema no lo dice en el diálogo: hay que ir a
Ajustes → Aplicaciones → AICFES → menú de tres puntos → **"Permitir
ajustes restringidos"**, y recién ahí el permiso se puede conceder.

Esto **no es un teléfono raro**: le pasa a cualquiera que instale un
APK directo, que es exactamente cómo vamos a poner la app frente a
estudiantes para validar el peaje. Un estudiante que llegue a ese
muro sin instrucciones abandona ahí. El onboarding tiene que
detectarlo y explicarlo con esas palabras, no con "conceda el permiso
de acceso de uso".

**Lo que falló y era culpa nuestra, no del módulo:** `<ActivityPicker>`
salió como un recuadro vacío. La vista nativa se mide con el `style`
que React Native le pasa, y sin uno queda en **altura cero**. El
README del módulo pasa `style={{ flex: 1 }}` por esta razón. Con el
recuadro vacío el módulo parecía roto cuando lo único que faltaba era
una altura.

Segundo error del mismo banco: el `onSelectionChange` leía un campo
`count` que no existe. El payload es `{metadata, tokens}` y la cuenta
está en `metadata.applicationCount`. Habría impreso `?` y parecido
otro fallo del selector.

---

## Qué haría falta cuando se decida construirlo

En orden, y el primero es el que decide si vale la pena:

1. **Un development build de prueba** solo para comprobar que el
   módulo hace lo que dice en un teléfono real: permisos, selector,
   bloqueo, desbloqueo temporal.
2. El onboarding de permisos. Son varios pasos, uno por pantalla del
   sistema, y el módulo los expone de a uno
   (`requestScreenTimePermissionsAsync` con `step`). **Tiene que
   cubrir los ajustes restringidos de Android 13+** (ver arriba): sin
   eso, un estudiante con un APK instalado a mano se queda trancado en
   el permiso de acceso de uso sin entender por qué.
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
