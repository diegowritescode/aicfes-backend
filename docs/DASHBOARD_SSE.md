# Dashboard Realtime (SSE)

This document describes the Server-Sent Events (SSE) stream added for realtime dashboard updates.

## Endpoint

**GET** `/api/dashboard/stream`

**Auth (recommended):** access token is now set as httpOnly cookie by `/api/auth/login` and `/api/auth/refresh`, so SSE works without custom headers.

Fallback (non-production):
```
X-User-Id: <userId>
```

---

## What it does
- Opens a long-lived SSE connection.
- Immediately emits `dashboard:init` with the current dashboard payload.
- Emits `dashboard:update` when backend data changes (sessions, answers, heartbeat, completion).
- Sends `ping` events every ~25s to keep the connection alive.

---

## Event types

### `dashboard:init`
Initial dashboard payload when the stream opens.

### `dashboard:update`
Payload:
```json
{
  "reason": "session_created | session_started | session_completed | answers_created | heartbeat",
  "data": { /* full dashboard payload */ },
  "cached": true
}
```

### `ping`
Keep-alive event:
```json
{ "t": 1710000000000 }
```

---

## Frontend example (vanilla)
```ts
const stream = new EventSource('http://localhost:3000/api/dashboard/stream', {
  withCredentials: true,
});

stream.addEventListener('dashboard:init', (event) => {
  const data = JSON.parse(event.data);
  renderDashboard(data);
});

stream.addEventListener('dashboard:update', (event) => {
  const payload = JSON.parse(event.data);
  renderDashboard(payload.data);
});

stream.addEventListener('ping', () => {});
```

> EventSource does not allow custom headers in browsers. Use the access-token cookie auth or append `?userId=...` as fallback.

---

## Frontend example (with fallback)
If SSE is blocked or unavailable, poll every 15–30s (with credentials if you rely on cookies):
```ts
setInterval(async () => {
  const res = await fetch('/api/dashboard', { credentials: 'include' });
  const payload = await res.json();
  renderDashboard(payload.data);
}, 20000);
```

---

## Notes
- SSE is one-way (server → client). For bidirectional realtime, use WebSockets.
- The stream reuses the same dashboard payload as `/api/dashboard`.
- The backend emits updates after: start/heartbeat/complete sessions and answers.
