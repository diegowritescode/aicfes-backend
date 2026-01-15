# Retroalimentacion IA Personalizada (Feedback)

Este documento describe el contrato del backend para generar y consultar feedback por sesion.

## Endpoints

### 1) Generar feedback
**POST** `/api/feedback/generate`

Body:
```json
{
  "sessionId": "cmk...",
  "mode": "generacion_libre",
  "focus": "summary",
  "language": "es",
  "force": false
}
```

Respuesta:
```json
{
  "ok": true,
  "data": {
    "summary": "Resumen corto...",
    "strengths": [ { "area": "LC", "note": "..." } ],
    "weaknesses": [ { "area": "MAT", "note": "..." } ],
    "plan": [ { "title": "Practica MAT", "detail": "..." } ],
    "insights": {
      "avgTimePerQuestionSeconds": 42,
      "accuracy": 0.7,
      "speedNote": "..."
    },
    "generatedAt": "2024-10-01T20:10:00Z",
    "model": "gpt-4o-mini",
    "promptVersion": "v1"
  },
  "meta": { "sessionId": "cmk...", "cached": false }
}
```

Notas:
- Si ya existe feedback y `force=false`, devuelve cache.
- Si `force=true` pero no ha pasado el cooldown, devuelve cache.

---

### 2) Consultar feedback
**GET** `/api/feedback/:sessionId`

Si existe:
```json
{ "ok": true, "data": { /* feedback */ }, "meta": { "sessionId": "cmk...", "cached": true } }
```

Si no existe:
```json
{ "ok": false, "error": { "code": "NOT_FOUND", "message": "No feedback available." } }
```

---

### 3) Regenerar feedback
**POST** `/api/feedback/:sessionId/regenerate`

Equivale a `generate` con `force=true`.

---

## Datos usados
- answersHistory (si hay answers)
- areaSummary (si no hay answers)
- durationSeconds
- totalQuestions / correctQuestions
- mode

---

## Cooldown
Configurable por env:
```
FEEDBACK_COOLDOWN_MINUTES=20
```

---

## Modelo
Configurable por env:
```
OPENAI_FEEDBACK_MODEL=gpt-4o-mini
```

---

## SSE
Cuando se genera feedback:
```
feedback:ready { sessionId }
```

---

## Ejemplo frontend
```ts
const res = await fetch('/api/feedback/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sessionId, focus: 'summary', language: 'es' }),
});

const payload = await res.json();
```
