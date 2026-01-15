# Completar sesiones mixtas con resumen por area

Este cambio permite que el frontend envíe un resumen por area al completar una sesion, sin necesidad de mandar todas las respuestas.

## Nuevo campo en complete
Endpoint: **POST** `/api/study-sessions/:sessionId/complete`

Ahora acepta `areaSummary`:
```json
{
  "endedAt": "2024-10-01T20:10:00Z",
  "durationSeconds": 600,
  "totalQuestions": 20,
  "correctQuestions": 14,
  "areaSummary": [
    { "area": "MAT", "totalQuestions": 5, "correctQuestions": 3 },
    { "area": "LC", "totalQuestions": 7, "correctQuestions": 5 },
    { "area": "ING", "totalQuestions": 3, "correctQuestions": 2 },
    { "area": "SOC", "totalQuestions": 3, "correctQuestions": 2 },
    { "area": "CN", "totalQuestions": 2, "correctQuestions": 2 }
  ]
}
```

### Reglas
- Si `areaSummary` viene, el backend recalcula `totalQuestions` y `correctQuestions` con la suma de ese arreglo.
- Cada bloque valida que `correctQuestions <= totalQuestions`.
- Esto permite que el dashboard calcule **progreso por area** correctamente aun cuando la sesion es mixta.

## Impacto en metricas
- **Progreso por area** usa `areaSummary` cuando no hay answers por pregunta.
- **Misiones** basadas en conteos por area también usan el resumen.
- **XP** sigue usando la dificultad de la sesion si no hay respuestas por pregunta.

## Flujo recomendado (mixto)
1) Generar items con `session.create=true` (recibe `sessionId`).
2) Al finalizar, enviar `complete` con `areaSummary`.
3) (Opcional) Enviar `answers` si deseas XP por dificultad real por pregunta.

## Ejemplo frontend
```ts
await fetch(`/api/study-sessions/${sessionId}/complete`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    endedAt,
    durationSeconds,
    totalQuestions: 20,
    correctQuestions: 14,
    areaSummary,
  }),
});
```
