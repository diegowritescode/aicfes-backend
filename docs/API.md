# 📚 AICFES Item Generator API - Documentación Completa

> **⚠️ Incompleto. Revisado el 23 nov 2026.**
>
> Esta página solo cubre `items` y `health`. Es anterior a nueve
> módulos y no documenta ninguno: `auth`, `tutoria`, `figuras`,
> `simulacro`, `time-trial`, `error-del-dia`, `achievements`,
> `repaso` ni `duelos`.
>
> **No se va a completar a mano**, y eso es deliberado: un catálogo
> escrito a mano se desactualiza en silencio, que es exactamente lo
> que le pasó a esta página. Para el catálogo real y siempre al día:
> **`/api/docs`** (Swagger, se genera del código).
>
> Una excepción: `moderacion` no aparece en Swagger tampoco, por
> `@ApiExcludeController`. Está documentado en
> [MODERACION.md](MODERACION.md), que es donde tiene sentido —
> es un runbook, no un catálogo.
>
> Para entender los flujos: [ARQUITECTURA.md](ARQUITECTURA.md).

## 🔗 URLs de Documentación

**Swagger UI (NestJS):**
```
http://localhost:3000/docs
```

**OpenAPI JSON:**
```
http://localhost:3000/docs-json
```

---

## 📖 Información de la API

- **Versión**: 1.0.0
- **Título**: AICFES Item Generator API
- **Descripción**: API para generar ítems de examen tipo ICFES usando inteligencia artificial
- **Modelo IA**: GPT-5-mini (configurable)
- **Framework**: NestJS 10.0.0
- **Base URL**: `http://localhost:3000/api`

### Contacto
- Email: support@aicfes.example.com
- GitHub: https://github.com
- Licencia: MIT

---

## 🎯 Áreas Soportadas

| Código | Nombre | Descripción |
|--------|--------|-------------|
| **MAT** | Matemáticas | Aritmética, álgebra, geometría, estadística |
| **LC** | Lenguaje y Comunicación | Lectura, interpretación, redacción |
| **CN** | Ciencias Naturales | Biología, química, física |
| **SOC** | Sociales | Historia, geografía, economía, derecho |
| **ING** | Inglés | Vocabulario, gramática, comprensión |

---

## 🚀 Endpoints Principales

### `POST /api/items/generate`

Genera nuevos ítems de examen ICFES.

**Request Body:**
```json
{
  "area": "MAT",
  "dificultad": "facil",
  "n": 1,
  "tema": "división de números",
  "plantilla": "instrucción especial (opcional)"
}
```

**Respuesta (200 OK):**
```json
{
  "ok": true,
  "items": [ { ... } ],
  "meta": { "requestId": "...", "area": "MAT", ... }
}
```

### `GET /api/items?area=MAT&limit=10`

Lista ítems generados.

### `GET /api/items/requests?limit=20`

Estadísticas de requests de generación.

### `GET /api/items/requests/failed?limit=5`

Requests fallidos (debugging y auditoría).

### `GET /api/health`

Verifica que el servidor está operativo.

---

## 🔐 Validaciones

- **area**: MAT, LC, CN, SOC, ING
- **dificultad**: facil, media, alta
- **n**: 1-5 ítems
- **Límites de campo**: contexto (20-1200), pregunta (10-250), opciones (5-180)

---

## 📚 Documentación Adicional

Consulta en `/docs/`:
- **API.md** - Este archivo
- **API_DEEPDIVE.md** - Documentación técnica detallada
- **HARDENING_COMPLETE.md** - Mejoras de seguridad

---

## 🎓 Ejemplos

### Generar ítems
```bash
curl -X POST http://localhost:3000/api/items/generate \
  -H "Content-Type: application/json" \
  -d '{"area":"MAT","dificultad":"facil","n":1}'
```

### Ver requests
```bash
curl "http://localhost:3000/api/items/requests?limit=20"
```

---

## 📄 Licencia

MIT - Libre para uso comercial y personal