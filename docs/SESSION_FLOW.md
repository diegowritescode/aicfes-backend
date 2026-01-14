# Session Start/Heartbeat/Complete (New Flow)

This document describes the new professional study-session flow that enables heartbeats before the session ends.

## Why this exists
Previously, sessions were only created at the end, so there was no `sessionId` to send heartbeats. The new flow creates the session at start and finalizes it later.

---

## Endpoints

### 1) Start session
**POST** `/api/study-sessions/start`

**Headers:**
```
Authorization: Bearer <ACCESS_TOKEN>
```

**Body:**
```json
{
  "mode": "generacion_libre",
  "area": "MAT",
  "dificultad": "media",
  "tema": "suma",
  "startedAt": "2024-10-01T20:00:00Z"
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "sessionId": "cmk...",
    "startedAt": "2024-10-01T20:00:00.000Z"
  },
  "meta": { "userId": "cmk..." }
}
```

---

### 2) Heartbeat (optional, repeatable)
**POST** `/api/study-sessions/:sessionId/heartbeat`

**Body:**
```json
{ "elapsedSeconds": 240 }
```

Optional:
```json
{ "elapsedSeconds": 600, "endedAt": "2024-10-01T20:10:00Z" }
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "id": "cmk...",
    "durationSeconds": 240,
    "endedAt": "2024-10-01T20:00:00.000Z",
    "lastHeartbeatAt": "2024-10-01T20:04:00.000Z"
  },
  "meta": { "userId": "cmk..." }
}
```

---

### 3) Complete session
**POST** `/api/study-sessions/:sessionId/complete`

**Body:**
```json
{
  "endedAt": "2024-10-01T20:10:00Z",
  "durationSeconds": 600,
  "totalQuestions": 5,
  "correctQuestions": 3
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "sessionId": "cmk...",
    "xpAwarded": 40,
    "xpDelta": 40
  },
  "meta": { "userId": "cmk..." }
}
```

`xpDelta` is the actual XP written at completion (in case of re-completion or partial data).

---

## Frontend flow example

1. **Start** session when the user begins:
```ts
const start = await fetch('/api/study-sessions/start', { method: 'POST', body: JSON.stringify(payload) });
const { sessionId } = await start.json();
```

2. **Send heartbeats** every 30–60s:
```ts
setInterval(() => {
  fetch(`/api/study-sessions/${sessionId}/heartbeat`, {
    method: 'POST',
    body: JSON.stringify({ elapsedSeconds })
  });
}, 60000);
```

3. **Complete** when the test finishes:
```ts
await fetch(`/api/study-sessions/${sessionId}/complete`, {
  method: 'POST',
  body: JSON.stringify({ endedAt, durationSeconds, totalQuestions, correctQuestions })
});
```

---

## Notes
- The old endpoint `/api/study-sessions` still works if you only send data at the end.
- Heartbeats update `durationSeconds` safely (max seen value).
- The dashboard uses the finished session data (duration and questions) for streak, time studied, XP, and missions.
