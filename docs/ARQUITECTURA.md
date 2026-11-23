# Arquitectura

Qué hay, cómo se conecta y por qué. Los diagramas son Mermaid: se
renderizan solos en GitHub y viven en git como texto, así que no hay
una imagen que se quede vieja sin que nadie lo note.

Todo lo que sigue se leyó del código, no de la memoria. Si algo no
coincide, el código manda y esta página está mal.

---

## El sistema completo

```mermaid
flowchart TB
    subgraph disp["En el teléfono"]
        app["App Expo / React Native<br/>(rama movil)"]
    end

    subgraph nav["En el navegador"]
        web["Web estática<br/>(rama main, Vite)"]
    end

    subgraph vps["VPS"]
        traefik["Traefik<br/>TLS, enruta por dominio"]
        api["API NestJS<br/>:3000"]
        pg[("PostgreSQL 16<br/>+ pgvector")]
    end

    subgraph fuera["Fuera"]
        openai["OpenAI<br/>genera y puntúa"]
        anthropic["Anthropic<br/>verifica de otra familia"]
    end

    app -->|HTTPS| traefik
    web -->|HTTPS| traefik
    traefik --> api
    api --> pg
    api --> openai
    api -.->|si hay clave| anthropic
```

Traefik y la red `edge` se crean **fuera de este repo**: el compose
solo declara sus etiquetas. Ni la API ni Postgres publican puertos, así
que lo único alcanzable desde internet es lo que Traefik enruta.

---

## Los módulos y quién depende de quién

Leído de los `imports` de cada `*.module.ts`.

```mermaid
flowchart TD
    persistence["persistence<br/>Prisma"]
    calidad["calidad<br/>costos, cuota, debilidades"]
    items["items<br/>genera y verifica"]
    dashboard["dashboard<br/>XP, racha, misiones"]
    auth["auth"]
    tutoria["tutoria"]
    simulacro["simulacro"]
    timetrial["time-trial"]
    feedback["feedback"]
    figuras["figuras"]
    health["health"]

    auth --> persistence
    calidad --> persistence
    figuras --> persistence
    dashboard --> persistence
    dashboard --> calidad
    items --> persistence
    items --> dashboard
    items --> calidad
    tutoria --> items
    tutoria --> calidad
    tutoria --> persistence
    simulacro --> items
    simulacro --> persistence
    timetrial --> items
    timetrial --> dashboard
    timetrial --> calidad
    timetrial --> persistence
    feedback --> items
    feedback --> dashboard
    feedback --> persistence
```

`health` no importa nada, a propósito: tiene que poder responder cuando
lo demás esté roto. (Hoy no consulta la base, lo que significa que puede
decir 200 con Postgres caído — anotado como deuda.)

**Por qué `calidad` es su propio módulo:** tanto el generador como el
panel registran medidas. Si la medición viviera dentro de cualquiera de
los dos, los dos se importarían mutuamente.

---

## Generar una pregunta

El camino que cuesta dinero, con el orden que lo abarata.

```mermaid
sequenceDiagram
    autonumber
    participant E as Estudiante
    participant G as SesionRequeridaGuard
    participant C as CuotaGuard
    participant Gen as Generador
    participant Ref as Banco de referencia
    participant O as OpenAI
    participant Dup as Deduplicación
    participant V as Verificador
    participant DB as PostgreSQL

    E->>G: POST /api/items/generate
    G->>G: ¿hay token?
    G--xE: 401 si no
    G->>C: userId
    C->>DB: ¿qué plan tiene?
    C->>DB: ¿cuánto gastó hoy?
    C--xE: 429 si pasó su tope
    C->>Gen: adelante

    Gen->>Ref: 4 ítems reales del área
    Ref-->>Gen: evidencia (nunca se sirve)
    Gen->>O: escribe N preguntas
    O-->>Gen: JSON con esquema estricto

    loop por cada pregunta
        Gen->>Dup: ¿ya existe algo así?
        Note over Dup: Antes de verificar,<br/>porque verificar cuesta
        Dup--xGen: descartada si se parece
        Gen->>V: resuélvela tú
        Note over V: Otro modelo, otra familia:<br/>el generador comparte<br/>sus propios puntos ciegos
        V--xGen: descartada si no coincide
        Gen->>DB: guardar verificada
    end

    Gen->>DB: registrar costo real
    Gen-->>E: las preguntas
```

Dos decisiones que el diagrama hace visibles:

**La deduplicación va antes de la verificación.** Verificar cuesta una
petición a un modelo; descartar un duplicado no cuesta nada. Al revés
se pagaría por validar algo que se iba a tirar.

**El verificador es de otra familia de modelos.** Un generador que se
verifica a sí mismo comparte sus propios puntos ciegos.

---

## Responder y que cuente

```mermaid
sequenceDiagram
    autonumber
    participant E as Estudiante
    participant API as API
    participant DB as PostgreSQL
    participant Cal as calidad

    E->>API: POST /api/study-sessions/start
    API->>DB: crear StudySession
    API-->>E: sessionId

    loop mientras responde
        E->>API: POST /api/answers
        API->>DB: guardar Answer
        API->>Cal: actualizar PerfilDebilidad
        API->>Cal: actualizar calidad del ítem
        API->>DB: XPEvent por acierto
    end

    E->>API: POST /api/study-sessions/:id/complete
    API->>DB: XP por tiempo, cerrar sesión
    API->>DB: progreso de misiones
    API-->>E: resumen

    opt si lo pide
        E->>API: POST /api/feedback/generate
        Note over API: Bajo demanda:<br/>escribir el plan cuesta,<br/>y no todos lo quieren
        API-->>E: plan de estudio
    end
```

El plan de estudio **no** se genera al terminar. Cuesta una petición a
un modelo, y alguien que acaba de terminar puede querer irse.

---

## La sesión del estudiante

Dos clientes, dos formas de guardar el token, por la misma razón de
seguridad en cada caso.

```mermaid
flowchart TB
    subgraph movil["App nativa"]
        m1["Entra"] --> m2["Manda X-Cliente: movil"]
        m2 --> m3["Recibe token + refreshToken<br/>en el cuerpo"]
        m3 --> m4[("expo-secure-store<br/>Keychain / EncryptedSharedPreferences")]
    end

    subgraph webc["Navegador"]
        w1["Entra"] --> w2["Sin cabecera"]
        w2 --> w3["Recibe token en el cuerpo,<br/>refresh en cookie httpOnly"]
        w3 --> w4[("Cookie que<br/>JavaScript no puede leer")]
    end

    m4 --> r{"¿401?"}
    w4 --> r
    r -->|sí| ren["Renovar una vez<br/>(compartida entre peticiones)"]
    ren -->|funcionó| rep["Repetir la petición"]
    ren -->|falló| login["Ahora sí, el login"]
    r -->|no| ok["Seguir"]
```

**Por qué distinto en cada uno:** en el navegador, una cookie `httpOnly`
es inalcanzable para un XSS. En el teléfono no hay cookies fiables, y el
almacén del sistema operativo es más seguro que una cookie, no menos.

**Por qué la renovación es compartida:** el panel dispara varias
peticiones a la vez. Si todas reciben 401 y cada una renueva, la segunda
gasta un token que la primera ya rotó — y el mecanismo para mantener la
sesión la mataría. Ver
[ADR 7](adr/0007-a-native-client-holds-its-own-refresh-token.md) y
[ADR 8](adr/0008-the-client-renews-before-it-reports-a-lost-session.md).

---

## El despliegue

```mermaid
flowchart LR
    dev["git push<br/>a main"] --> ci

    subgraph ci["CI (GitHub Actions)"]
        direction TB
        c1["npm ci"] --> c2["prisma generate"]
        c2 --> c3["nest build"]
        c3 --> c4["migrate deploy<br/>en base limpia"]
        c4 --> c5["migrate diff<br/>¿migraciones = esquema?"]
        c5 --> c6["npm test"]
        c6 --> c7["docker build<br/>sin publicar"]
    end

    ci -->|si pasa| rel["release.yml"]
    rel --> ghcr[("ghcr.io<br/>aicfes-api:SHA y :latest")]
    ghcr -.->|manual| vps["VPS:<br/>cambiar AICFES_API_TAG<br/>docker compose up -d"]
```

**No hay despliegue automático.** La imagen se publica; poner esa
etiqueta en producción es un cambio a mano en `deploy/.env`. Eso es
deliberado: dos imágenes pueden coexistir, así que volver atrás es
cambiar una etiqueta.

El paso `migrate diff` es el que hace cierto el
[ADR 2](adr/0002-migrations-are-the-source-of-truth.md): una migración
escrita a mano que no describa el esquema rompe el CI.

---

## Las capas del móvil

El otro repo tiene su propia arquitectura, verificada por pruebas:

```mermaid
flowchart TD
    app["app/<br/>rutas de expo-router"] --> features
    features["features/<br/>una carpeta por capacidad"] --> shared
    shared["shared/<br/>lo que usan 3+ features"] --> core
    core["core/<br/>HTTP, almacenamiento, config"]
```

Las reglas no son una promesa: `src/shared/arquitectura/capas.test.ts`
falla la compilación si una feature importa de otra, si `core` mira
hacia arriba, o si algo en `model/` importa react. Escribir esas
pruebas encontró seis violaciones el primer día.

Detalle en
[`aicfes-frontend/movil/ARQUITECTURA.md`](https://github.com/diegowritescode/aicfes-frontend/blob/movil/movil/ARQUITECTURA.md).

---

## Ver también

- [Modelo de datos](MODELO-DE-DATOS.md) — las 18 tablas y sus relaciones
- [Infraestructura](INFRAESTRUCTURA.md) — compose, variables, runbook
- [Decisiones (ADR)](adr/) — por qué cada cosa es como es
