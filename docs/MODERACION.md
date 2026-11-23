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
# Genere el secreto en el servidor, así nunca viaja a ninguna parte:
openssl rand -hex 32
# Agréguelo a .env como MODERACION_TOKEN=...
docker compose up -d api
```

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

**Nadie le avisa.** Hay que acordarse de mirar. `pendientes` existe
para que preguntarlo cueste una petición, pero nada lo pregunta solo.
Mientras los duelos sean de prueba eso alcanza; cuando lleguen
estudiantes reales, no.

**El secreto es compartido**, así que no registra *quién* actuó. Con un
solo moderador esa distinción no existe. Con dos, es lo primero que
faltaría — y ahí es cuando conviene el rol en `User` que ADR 33
descartó por ahora.

**No hay interfaz**, solo rutas HTTP. Sirve para una persona con
terminal. No sirve para alguien que no sea ingeniero.
