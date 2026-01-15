# Contrarreloj (Time Trial) - Backend v1

Este documento describe los endpoints y reglas del modo Contrarreloj.

## Endpoints

### 1) Listar modos
**GET** `/api/time-trial/modes`

**Respuesta**
```json
{
  "ok": true,
  "data": [
    {
      "id": "sprint_10",
      "title": "Sprint 10",
      "description": "10 preguntas mixtas en 10 minutos",
      "timeLimitSeconds": 600,
      "questions": 10,
      "mix": [
        { "area": "MAT", "dificultad": "media", "n": 2 },
        { "area": "LC", "dificultad": "media", "n": 3 },
        { "area": "CN", "dificultad": "media", "n": 2 },
        { "area": "SOC", "dificultad": "media", "n": 2 },
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
{ "modeId": "sprint_10" }
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
