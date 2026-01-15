# Generacion libre mixta (armable por secciones)

Este documento describe el nuevo endpoint para generar una prueba "armable" por secciones (area + dificultad + n).

## Endpoint

**POST** `/api/items/generate-mixed`

## Body
```json
{
  "sections": [
    { "area": "MAT", "dificultad": "alta", "n": 5, "tema": "opcional" },
    { "area": "LC", "dificultad": "media", "n": 7 },
    { "area": "ING", "dificultad": "facil", "n": 3 },
    { "area": "SOC", "dificultad": "alta", "n": 3 },
    { "area": "CN", "dificultad": "facil", "n": 2 }
  ],
  "shuffle": true,
  "session": {
    "create": true,
    "mode": "generacion_libre",
    "startedAt": "2024-10-01T20:00:00Z",
    "timezone": "America/Bogota",
    "seedAreaSummary": true
  }
}
```

- `sections`: lista de bloques a generar.
- `shuffle`: si `true`, mezcla los items finales.
- `session.create`: si `true`, crea una sesión y devuelve `sessionId` para métricas.
- `session.seedAreaSummary`: si `true`, precarga el resumen por area con los `n` de cada seccion.

## Respuesta
```json
{
  "ok": true,
  "items": [ /* items combinados */ ],
  "meta": {
    "requestId": "batchId",
    "totalRequested": 20,
    "totalGenerated": 20,
    "sections": [
      { "requestId": "req1", "area": "MAT", "dificultad": "alta", "n": 5, "generated": 5 },
      { "requestId": "req2", "area": "LC", "dificultad": "media", "n": 7, "generated": 7 }
    ],
    "shuffle": true,
    "session": { "sessionId": "cmk...", "startedAt": "2024-10-01T20:00:00.000Z" }
  }
}
```

Si ninguna seccion genera items validos:
```json
{
  "ok": false,
  "items": [],
  "meta": { "requestId": "batchId", "totalRequested": 20, "totalGenerated": 0 },
  "error": { "code": "GENERATION_FAILED", "message": "No valid items generated for any section." }
}
```

## Validaciones
- `area` en {MAT, LC, CN, SOC, ING}
- `dificultad` en {facil, media, alta}
- `n >= 1`
- `totalRequested <= MAX_ITEMS` (config en `.env`)

## Ejemplo frontend (fetch)
```ts
const payload = {
  sections: [
    { area: 'MAT', dificultad: 'alta', n: 5 },
    { area: 'LC', dificultad: 'media', n: 7 },
    { area: 'ING', dificultad: 'facil', n: 3 },
    { area: 'SOC', dificultad: 'alta', n: 3 },
    { area: 'CN', dificultad: 'facil', n: 2 },
  ],
  shuffle: true,
};

const res = await fetch('/api/items/generate-mixed', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

const data = await res.json();
```

## Notas
- El endpoint reutiliza el generador actual por cada seccion.
- Cada seccion queda registrada con su propio `requestId`.
- Si una seccion falla, el resto sigue y se entrega lo generado.
- Si `session.create=true`, el frontend debe usar el `sessionId` para:
  - `POST /api/answers`
  - `POST /api/study-sessions/:sessionId/heartbeat` (opcional)
  - `POST /api/study-sessions/:sessionId/complete` (al finalizar)
- Si `seedAreaSummary=true`, el dashboard podra reflejar progreso por area usando los `n` solicitados aun sin answers.
