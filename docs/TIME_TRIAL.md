# Contrarreloj (Time Trial) - Backend

Este documento describe los endpoints y reglas del modo Contrarreloj.

> **Actualizado el 23 nov 2026.** Dos cosas cambiaron desde la primera
> versión y esta página las traía mal:
>
> **Los modos.** `sprint_10`, `reto_5` y `explosivo` están retirados
> (ADR 25). Los tres daban 60 segundos por pregunta, así que no había
> escalera — y el examen real da 64, con lo que el modo llamado
> "explosivo" era *más fácil* que el examen. Hoy son cinco niveles
> anclados a ese número: Calentamiento (90s), Ritmo real (64s), Bajo
> presión (45s), Muerte súbita (30s) y Las cinco áreas (64s). Ninguno
> fija un área: todos preguntan al perfil de debilidades.
>
> **De dónde salen las preguntas.** Ya no se generan: salen del banco
> verificado, y solo se genera lo que falte (ADR 31). Antes una ronda
> de ocho eran ocho peticiones al modelo por preguntas que ya
> existían, y "Las cinco áreas" hacía cinco llamadas **en secuencia**.
> Medido en producción el 23 nov 2026: los tres modos probados
> responden en **0,5-0,6 segundos con cero generaciones**.

## Endpoints

### 1) Listar modos
**GET** `/api/time-trial/modes`

**Respuesta**
```json
{
  "ok": true,
  "data": [
    {
      "id": "simulacro-mixto",
      "title": "Las cinco áreas",
      "description": "Una de cada área, como viene el examen: revuelto y sin avisar.",
      "timeLimitSeconds": 320,
      "questions": 5,
      "nivel": 2,
      "segundosPorPregunta": 64,
      "area": null,
      "dificultad": null,
      "mix": [
        { "area": "MAT", "dificultad": "media", "n": 1 },
        { "area": "LC", "dificultad": "media", "n": 1 },
        { "area": "CN", "dificultad": "media", "n": 1 },
        { "area": "SOC", "dificultad": "media", "n": 1 },
        { "area": "ING", "dificultad": "media", "n": 1 }
      ]
    }
  ],
  "meta": {}
}
```

---

### 2) Iniciar contrarreloj
**POST** `/api/time-trial/start`

Modo predefinido:
```json
{ "modeId": "ritmo-real" }
```

Modo personalizado:
```json
{
  "custom": {
    "area": "MAT",
    "dificultad": "alta",
    "timeLimitSeconds": 420,
    "questions": 7
  }
}
```

**Respuesta**
```json
{
  "ok": true,
  "data": {
    "sessionId": "cmk...",
    "timeLimitSeconds": 600,
    "items": [ /* preguntas */ ]
  },
  "meta": { "userId": "cmk..." }
}
```

---

### 3) Heartbeat
**POST** `/api/study-sessions/:sessionId/heartbeat`
```json
{ "elapsedSeconds": 240 }
```

---

### 4) Completar sesión
**POST** `/api/study-sessions/:sessionId/complete`
```json
{
  "endedAt": "2024-10-01T20:10:00Z",
  "durationSeconds": 600,
  "totalQuestions": 10,
  "correctQuestions": 7,
  "areaSummary": [
    { "area": "MAT", "totalQuestions": 2, "correctQuestions": 2 },
    { "area": "LC", "totalQuestions": 3, "correctQuestions": 2 }
  ]
}
```

---

## XP y Bonus de velocidad

**Base XP**
- 10 XP por respuesta correcta
- Multiplicador dificultad: facil=1.0, media=1.3, alta=1.7

**Bonus de velocidad**
```
accuracy = correctQuestions / totalQuestions
speedFactor = max(0, (timeLimitSeconds - durationSeconds) / timeLimitSeconds)
bonusXP = round(speedFactor * totalQuestions * 4)
if (accuracy < 0.5) bonusXP = 0
```

**XP Total**
```
totalXP = baseXP + bonusXP
```

---

## Validaciones
- timeLimitSeconds >= 60
- questions >= 1
- correctQuestions <= totalQuestions
- modeId debe existir si se usa modo predefinido
- custom requiere area y dificultad

---

## Flujo recomendado (frontend)
1) `GET /api/time-trial/modes`
2) `POST /api/time-trial/start`
3) `POST /api/study-sessions/:id/heartbeat` (opcional)
4) `POST /api/study-sessions/:id/complete` con areaSummary
5) `GET /api/dashboard` o SSE
