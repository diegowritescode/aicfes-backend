# Moderación: cómo leer y atender las denuncias

Esta cola existe porque la app le promete algo a un estudiante. Cuando
denuncia a alguien, `ModalDenuncia` le dice:

> Una persona de nuestro equipo va a revisar lo que nos contó.

Esa persona es usted. Si nadie lee esto, la promesa es falsa — y un
botón de denuncia que nadie atiende es peor que no tenerlo (ADR 32,
ADR 33).

## Primero: poner el secreto

Las rutas están **cerradas** hasta que exista `MODERACION_TOKEN`. No es
un descuido: lo contrario —abiertas cuando falta la variable— filtraría
en silencio una cola de denuncias de menores el primer día que alguien
despliegue sin ella.

En el servidor, no por chat ni por este documento:

```bash
ssh aitera-vps
cd /home/diego/apps/aicfes/deploy

# 1. Genere el secreto EN EL SERVIDOR, así nunca viaja a ninguna parte.
#    No lo pegue en un chat ni en un documento: si lo hace, rótelo.
openssl rand -hex 32

# 2. Agréguelo a .env como MODERACION_TOKEN=...

# 3. Recree el contenedor.
docker compose up -d --force-recreate api
```

**El paso que es fácil omitir:** `compose.yml` tiene que declarar la
variable en `environment:`. Compose **no** pasa `.env` al contenedor
por su cuenta — un secreto que está en `.env` y no en esa lista no
llega a ninguna parte, y la API responde 403 a su propio token sin
decir por qué. Así se desplegó la primera vez.

Ya está declarada en `deploy/compose.yml`. Si alguna vez vuelve a dar
403 con el token correcto, lo primero es comprobar que el contenedor
la ve, sin imprimir el valor:

```bash
docker compose exec -T api sh -c 'echo ${#MODERACION_TOKEN}'
# 64 si llegó. 0 si no llegó.
```

Y que `up -d` recreó el contenedor en vez de dejarlo corriendo: si
dice `Running` y no `Recreated`, el cambio no se aplicó. Por eso el
`--force-recreate` de arriba — cambiar solo `.env`, sin cambiar la
imagen, no basta para que compose recree nada.

Para comprobar que quedó: sin la cabecera debe responder **403**.

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  https://aicfes-backend.deviego.xyz/api/moderacion/cola
# 403
```

## La pregunta de cada día

Una sola petición dice si la cola está siendo atendida:

```bash
curl -s -H "x-moderacion-token: $TOKEN" \
  https://aicfes-backend.deviego.xyz/api/moderacion/pendientes
```

```json
{"ok":true,"data":{"abiertas":3,"diasDeLaMasAntigua":2}}
```

`diasDeLaMasAntigua` es el número que importa. **Si pasa de 1, alguien
denunció algo y lleva más de un día esperando.**

## Leer la cola

```bash
curl -s -H "x-moderacion-token: $TOKEN" \
  'https://aicfes-backend.deviego.xyz/api/moderacion/cola?limite=20'
```

Viene la más vieja primero, a propósito: la que lleva tres días
esperando es la que le falló a quien la mandó.

Dos campos que no son obvios y son los que deciden:

- `denunciasTotales` — cuántas denuncias tiene esa cuenta en total.
- `personasQueLoDenunciaron` — **cuántas personas distintas**.

La diferencia importa. `totales=3, personas=1` es una persona
insistiendo, que puede ser un conflicto entre dos. `totales=3,
personas=3` es un patrón.

## Ver todo sobre una cuenta

```bash
curl -s -H "x-moderacion-token: $TOKEN" \
  https://aicfes-backend.deviego.xyz/api/moderacion/cuenta/$USER_ID
```

Trae la cuenta y hasta 100 denuncias sobre ella, con su estado y
quién la mandó.

## Actuar

**Sacar de búsqueda** — la acción principal. No borra nada: el
estudiante conserva cuenta, historial y nombre, y deja de ser
encontrable. Los duelos abiertos se cancelan, o la cuenta seguiría
apareciendo en la pantalla de otros después de haberla sacado.

```bash
curl -s -X POST -H "x-moderacion-token: $TOKEN" \
  https://aicfes-backend.deviego.xyz/api/moderacion/cuenta/$USER_ID/retirar-de-busqueda
```

Es reversible: el estudiante puede volver a activarse desde sus
propios ajustes. Si el caso es grave, hay que intervenir a mano en la
base — no está automatizado a propósito, porque borrarle la cuenta a
un menor por una denuncia que nadie verificó no es una decisión para
automatizar.

**Cerrar la denuncia** — siempre, incluso cuando no se hizo nada. Son
dos cosas distintas:

```bash
# Se revisó y se actuó, o se revisó y había algo que atender:
curl -s -X POST -H "x-moderacion-token: $TOKEN" \
  -H 'content-type: application/json' -d '{"estado":"revisada"}' \
  https://aicfes-backend.deviego.xyz/api/moderacion/denuncia/$ID/resolver

# Se revisó y no había nada:
curl -s -X POST -H "x-moderacion-token: $TOKEN" \
  -H 'content-type: application/json' -d '{"estado":"descartada"}' \
  https://aicfes-backend.deviego.xyz/api/moderacion/denuncia/$ID/resolver
```

## Lo que esta cola no hace todavía

**Ahora le llega un correo.** Desde el 24 nov 2026, cada denuncia
dispara un correo por Resend, si están puestas estas dos variables en
el servidor:

```bash
RESEND_API_KEY=...          # la misma clave que usa Zyrcle sirve
MODERACION_CORREO=usted@sucorreo.com
CORREO_REMITENTE=AICFES <no-reply@un-dominio-verificado>
```

**Las tres hacen falta.** `CORREO_REMITENTE` no tiene valor por
omisión a propósito: lo tuvo, apuntando a `aicfes.deviego.xyz`, y
**todos los envíos fallaron con 403** porque ese dominio no estaba
verificado en Resend. La configuración se veía completa y el correo
no llegaba. Ahora, sin remitente, no se intenta enviar y se anota en
el log, que es donde se ve.

**El dominio del remitente tiene que estar verificado en Resend**
(resend.com/domains). Uno sin verificar se rechaza, se escriba como
se escriba la dirección. Hoy `zyrcle.deviego.xyz` lo está y
`aicfes.deviego.xyz` no.

Sin ellas no se envía nada y queda anotado en el log — la denuncia se
guarda igual y la cola se sigue leyendo en la app. Una denuncia nunca
falla porque el correo esté mal configurado.

**Para comprobar que el correo funciona**, basta con mirar el log
después de una denuncia:

```bash
docker compose logs api --since 10m | grep -i correo
```

Si dice `Resend respondió 403`, el dominio no está verificado. Si no
dice nada, salió bien.

**El asunto lleva el patrón adelante**, porque es la única línea que
siempre se lee: "3 personas denunciaron a fulano" en vez de "nueva
denuncia". **El cuerpo no lleva lo que escribió quien denunció**: una
denuncia por acoso puede citar el acoso, y reenviar el relato de un
menor a una bandeja, por un tercero, agrega exposición sin agregar
una decisión. El detalle vive en la app, detrás del token.

**Sigue sin haber aviso dentro de la app con ella cerrada.** La app
pregunta `pendientes` cada vez que se abre y muestra un aviso en
Inicio si hay algo esperando, con los números: "3 denuncias sin
revisar, la más vieja de hace 2 días". También se puede leer y
atender la cola desde el teléfono — pegando el token una vez, que
queda cifrado en el llavero del sistema.

Lo que eso **no** arregla: no hay notificaciones push. Los
recordatorios de esta app son locales, programados en el dispositivo,
así que nada puede alcanzarlo mientras la app está cerrada. Una
denuncia que entra con la app apagada espera hasta que la abra. Si
pasa de un día, el aviso lo dice en rojo; a los tres, dice que la cola
no se está atendiendo.

**El secreto es compartido**, así que no registra *quién* actuó. Con un
solo moderador esa distinción no existe. Con dos, es lo primero que
faltaría — y ahí es cuando conviene el rol en `User` que ADR 33
descartó por ahora.

**No hay interfaz**, solo rutas HTTP. Sirve para una persona con
terminal. No sirve para alguien que no sea ingeniero.
