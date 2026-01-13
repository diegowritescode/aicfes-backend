# 📚 AICFES Item Generator API - Documentación Técnica Completa

---

## Índice
1. [Visión General](#visión-general)
2. [Arquitectura e Infraestructura](#arquitectura-e-infraestructura)
3. [Patrones y Estilos de Código](#patrones-y-estilos-de-código)
4. [Estructura de Carpetas](#estructura-de-carpetas)
5. [Endpoints y Contrato de Respuesta](#endpoints-y-contrato-de-respuesta)
6. [Validaciones y Seguridad](#validaciones-y-seguridad)
7. [Manejo de Errores](#manejo-de-errores)
8. [Flujo de Trabajo](#flujo-de-trabajo)
9. [Integración Frontend](#integración-frontend)

---

## 1. Visión General

La API AICFES permite la generación, validación y consulta de ítems tipo ICFES usando inteligencia artificial. Está diseñada para ser robusta, auditable y fácil de consumir desde cualquier frontend moderno.

- **Framework:** NestJS 10.x (TypeScript)
- **ORM:** Prisma 5.x (PostgreSQL)
- **Validación:** Zod (schemas estrictos)
- **Documentación:** Swagger UI (`/docs`), OpenAPI JSON (`/docs-json`)
- **Modelo IA:** GPT-5-mini (OpenAI)
- **Frontend:** Desacoplado, consumo vía REST

---

## 2. Arquitectura e Infraestructura

### 2.1. Capas Principales
- **Controladores:** Exponen endpoints REST, validan y normalizan requests/responses
- **Servicios:** Lógica de negocio (generación, validación, normalización, persistencia)
- **Persistencia:** Prisma ORM con PostgreSQL (Aiven)
- **Middlewares:** RequestId, seguridad (Helmet), manejo global de errores
- **Validación:** Zod schemas + validaciones de negocio

### 2.2. Infraestructura
- **Servidor:** Node.js (NestJS)
- **Base de datos:** PostgreSQL (cloud, Aiven)
- **OpenAI:** API Key segura, configurable por env
- **Despliegue:** Compatible con Docker, PM2, Heroku, Vercel

---

## 3. Patrones y Estilos de Código

- **Modularidad:** Cada dominio (items, health, persistence) es un módulo NestJS
- **Inyección de dependencias:** Todos los servicios usan DI de NestJS
- **DTOs y Schemas:** Uso de Zod para validación estricta y tipado
- **Respuestas normalizadas:** Siempre `{ ok, items[], meta, error? }`
- **Errores controlados:** Nunca se lanzan excepciones crudas al cliente
- **Logging estructurado:** Cada request tiene un `requestId` para trazabilidad
- **Convenciones REST:** Verbos y rutas claras, pluralización, query params

---

## 4. Estructura de Carpetas

```
AICFES/
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── health/
│   │   └── health.controller.ts
│   ├── items/
│   │   ├── items.controller.ts
│   │   ├── services/
│   │   │   ├── item-generator.service.ts
│   │   │   ├── normalizer.service.ts
│   │   │   └── validators.service.ts
│   │   └── schemas/
│   │       └── item.schema.ts
│   ├── persistence/
│   │   └── persistence.service.ts
│   └── common/
│       ├── filters/
│       │   └── all-exceptions.filter.ts
│       └── middleware/
│           └── request-id.middleware.ts
├── prisma/
│   └── schema.prisma
├── public/
│   ├── index.html
│   ├── app.js
│   └── style.css
├── docs/
│   ├── API.md
│   ├── API_DEEPDIVE.md
│   └── HARDENING_COMPLETE.md
├── scripts/
│   └── test-docs.sh
├── package.json
└── README.md
```

---

## 5. Endpoints y Contrato de Respuesta

### 5.1. Endpoints Principales

- `GET /api/health` — Estado del servidor
- `POST /api/items/generate` — Generar ítems ICFES
- `GET /api/items` — Listar ítems generados (filtro por área)
- `GET /api/items/requests` — Estadísticas de requests
- `GET /api/items/requests/failed` — Requests fallidos (debug)

### 5.2. Contrato de Respuesta (SIEMPRE igual)

```json
{
  "ok": true,
  "items": [ ... ],
  "meta": { ... },
  "error": { ... } // solo si ok=false
}
```

---

## 6. Validaciones y Seguridad

### 6.1. Validación de Input
- **Zod schemas**: Validación estricta de todos los campos
- **Campos requeridos**: area, dificultad, n
- **Enums**: area (MAT, LC, CN, SOC, ING), dificultad (facil, media, alta)
- **Límites de longitud**: contexto (≤1200), pregunta (≤250), opciones (≤180)
- **Distractores**: tipos permitidos por área, respuesta_correcta debe ser "correcta"

### 6.2. Seguridad
- **CORS**: Configurable, por defecto `*`
- **Helmet**: Headers de seguridad HTTP
- **RequestId**: Trazabilidad de cada request
- **No expone stack traces**

---

## 7. Manejo de Errores

- **Errores de validación**: `ok: false`, código `VALIDATION_ERROR`
- **Errores de generación**: `ok: false`, código `GENERATION_FAILED`
- **Errores internos**: `ok: false`, código `INTERNAL_ERROR`
- **Auditoría**: Todos los errores guardados en BD con rawModelOutput y parseError

---

## 8. Flujo de Trabajo

1. Frontend envía request a `/api/items/generate`
2. Validación Zod - si falla, error inmediato
3. Se crea request en BD con requestId
4. Se llama a OpenAI para generar
5. NormalizerService limpia output (markdown, JSON, trimea campos)
6. Validación de negocio (distractores, correct answer, límites)
7. Si OK: guardar ítems y responder con items[] y meta
8. Si falla: 1 reintento automático con mensaje correctivo
9. Frontend recibe respuesta normalizada

---

## 9. Integración Frontend

- **Consumo vía REST**: fetch, axios, etc.
- **Siempre array en `items`** (incluso para n=1)
- **Manejar `ok` y mostrar errores amigables**
- **Usar `meta.requestId` para trazabilidad**
- **No asumir estructura extra**

---

## Contacto y Soporte
- Email: support@aicfes.example.com
- GitHub: https://github.com/aicfes/api

**Este documento es la referencia oficial para integraciones frontend.**