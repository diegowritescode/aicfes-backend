# 🎓 AICFES Item Generator API

> **⚠️ Tiene secciones duplicadas. Verificado el 22 nov 2026.**
>
> "Variables de Entorno" y "Estructura del Proyecto" aparecen más de
> una vez, con contenido que no coincide entre copias.
>
> Las versiones vigentes y verificadas:
> [INFRAESTRUCTURA.md](INFRAESTRUCTURA.md) para las variables y el
> despliegue, [ARQUITECTURA.md](ARQUITECTURA.md) para la estructura, y
> [MODELO-DE-DATOS.md](MODELO-DE-DATOS.md) para el esquema.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![NestJS](https://img.shields.io/badge/NestJS-10.x-red)](https://nestjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-2D3748)](https://www.prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-336791)](https://www.postgresql.org)

API robusta y escalable para generar ítems de examen tipo ICFES usando inteligencia artificial (OpenAI GPT-5-mini). Diseñada para consumo desde cualquier frontend moderno con contrato de API normalizado y auditable.

---

## 📑 Tabla de Contenidos

1. [Características](#-características)
2. [Requisitos](#-requisitos)
3. [Instalación](#-instalación)
4. [Configuración](#-configuración)
5. [Uso](#-uso)
6. [API Documentation](#-api-documentation)
7. [Estructura del Proyecto](#-estructura-del-proyecto)
8. [Arquitectura](#-arquitectura)
9. [Seguridad](#-seguridad)
10. [Deployment](#-deployment)
11. [Contributing](#-contributing)
12. [Licencia](#-licencia)

---

## ✨ Características

### 🎯 Generación de Ítems
- ✅ Generación automática de ítems ICFES usando IA (OpenAI)
- ✅ Soporte para 5 áreas: Matemáticas, Lenguaje, Ciencias, Sociales, Inglés
- ✅ 3 niveles de dificultad: fácil, media, alta
- ✅ Generación de 1-5 ítems por request
- ✅ Temas y plantillas personalizables

### 🔐 Robustez y Validación
- ✅ Validación estricta con Zod
- ✅ Límites ICFES automáticamente aplicados
- ✅ Retry inteligente (máximo 1)
- ✅ Normalización de output del modelo
- ✅ Validación de distractores por área
- ✅ Contrato de respuesta normalizado

### 📊 Debugging y Auditoría
- ✅ Cada request tiene `requestId` único
- ✅ Output crudo del modelo guardado en BD
- ✅ Parse status y errores registrados
- ✅ Endpoints de debugging para ver errores
- ✅ Estadísticas de requests en tiempo real

### 📚 Documentación Profesional
- ✅ Swagger UI integrado (`/docs`)
- ✅ OpenAPI JSON (`/docs-json`)
- ✅ Markdown documentation completa
- ✅ Ejemplos de uso en cURL, JavaScript, Python
- ✅ Guía técnica detallada

### 🚀 Escalabilidad
- ✅ Arquitectura modular con NestJS
- ✅ ORM con Prisma (fácil migraciones)
- ✅ PostgreSQL en cloud (Aiven)
- ✅ Listo para Docker, PM2, Heroku, Vercel
- ✅ CORS configurable

---

## 📋 Requisitos

### Sistema
- **Node.js**: 18.x o superior
- **npm**: 9.x o superior
- **PostgreSQL**: 14+ (local o cloud)
- **Git**: Para clonar el repositorio

### Cuentas
- **OpenAI**: API Key para GPT (https://platform.openai.com)
- **PostgreSQL**: Conexión a base de datos (recomendado Aiven)

### Variables de Entorno
```bash
DATABASE_URL="postgresql://user:password@host:port/dbname"
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4-mini"  # o gpt-3.5-turbo, gpt-5-mini, etc.
NODE_ENV="development"
PORT=3000
```

---

## 🔧 Instalación

### 1. Clonar el repositorio
```bash
git clone https://github.com/aicfes/api.git
cd api
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
```bash
cp .env.example .env
# Editar .env con tus credenciales
```

### 4. Configurar base de datos
```bash
# Crear las tablas
npx prisma migrate deploy

# Opcional: ver datos con Prisma Studio
npx prisma studio
```

### 5. Compilar TypeScript
```bash
npm run build
```

### 6. Iniciar servidor
```bash
# Desarrollo con hot-reload
npm run start:dev

# Producción
npm run start:prod
```

El servidor estará disponible en `http://localhost:3000`

---

## ⚙️ Configuración

### Variables de Entorno (`.env`)

```bash
# Base de Datos (Obligatorio)
DATABASE_URL="postgresql://user:password@host:port/dbname"

# OpenAI (Obligatorio)
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4-mini"

# Servidor (Opcional)
NODE_ENV="development"        # development | production
PORT=3000
LOG_LEVEL="debug"             # debug | info | warn | error

# CORS (Opcional)
CORS_ORIGIN="*"               # ej: https://app.example.com
```

### Modelos Soportados
```
gpt-4 (más poderoso, más caro)
gpt-4-turbo
gpt-4-mini (recomendado balance costo/calidad)
gpt-3.5-turbo (más barato)
gpt-5-mini (custom)
```

### Base de Datos

La configuración de Prisma está en `prisma/schema.prisma`. Tablas principales:

#### `Item`
```
id            String    @id @default(cuid())
area          String    (MAT, LC, CN, SOC, ING)
dificultad    String    (facil, media, alta)
plantilla     String
contexto      String
pregunta      String
opciones      Json      {A, B, C, D}
respuesta_correcta String
justificacion String
tags          String[]
distractores  Json
createdAt     DateTime  @default(now())
```

#### `GenerationRequest`
```
requestId           String    @id @unique
area                String
status              String    (SUCCESS, FAILED)
parseStatus         String    (OK, FAIL)
parseError          String?
itemsRequested      Int
itemsGenerated      Int
normalizedCount     Int
rawModelOutput      String?   (Text)
hasParseError       Boolean
createdAt           DateTime  @default(now())
```

---

## 🚀 Uso

### Iniciar el Servidor

```bash
# Desarrollo
npm run start:dev
# Salida: 🚀 Server running on port 3000 (model=gpt-4-mini)

# Producción
npm run build
npm run start:prod
```

### Acceder a la API

#### Documentación Interactiva
```
http://localhost:3000/docs          ← Swagger UI
http://localhost:3000/docs-json     ← OpenAPI JSON
```

#### Health Check
```bash
curl http://localhost:3000/api/health
# Respuesta: { "ok": true, "model": "gpt-4-mini", "ts": "2026-01-13T..." }
```

#### Generar Ítems
```bash
curl -X POST http://localhost:3000/api/items/generate \
  -H "Content-Type: application/json" \
  -d '{
    "area": "MAT",
    "dificultad": "facil",
    "n": 1,
    "tema": "división de números"
  }'
```

**Respuesta:**
```json
{
  "ok": true,
  "items": [
    {
      "area": "MAT",
      "dificultad": "facil",
      "plantilla": "Resuelve el siguiente problema",
      "contexto": "Juan tiene 24 caramelos para repartir entre 4 amigos...",
      "pregunta": "¿Cuántos caramelos le corresponden a cada niño?",
      "opciones": {
        "A": "4 caramelos",
        "B": "6 caramelos",
        "C": "8 caramelos",
        "D": "12 caramelos"
      },
      "respuesta_correcta": "B",
      "justificacion": "24 ÷ 4 = 6",
      "tags": ["división", "números enteros"],
      "distractores": {
        "A": "error_calculo",
        "B": "correcta",
        "C": "interpretacion_parcial",
        "D": "confunde_conceptos"
      }
    }
  ],
  "meta": {
    "requestId": "MUZqR_qVb5WfiRMoI8qgN",
    "area": "MAT",
    "dificultad": "facil",
    "tema": "división de números",
    "n": 1,
    "model": "gpt-4-mini"
  }
}
```

#### Listar Ítems
```bash
curl "http://localhost:3000/api/items?area=MAT&limit=10"
```

#### Ver Estadísticas
```bash
curl "http://localhost:3000/api/items/requests?limit=20"
```

#### Debug: Requests Fallidos
```bash
curl "http://localhost:3000/api/items/requests/failed?limit=5"
```

---

## 📚 API Documentation

### Endpoints Principales

| Método | Endpoint | Descripción | Parámetros |
|--------|----------|-------------|-----------|
| `GET` | `/api/health` | Health check | - |
| `POST` | `/api/items/generate` | Generar ítems | area, dificultad, n, tema?, plantilla? |
| `GET` | `/api/items` | Listar ítems | area?, limit? |
| `GET` | `/api/items/requests` | Estadísticas | limit? |
| `GET` | `/api/items/requests/failed` | Requests fallidos | limit? |

### Validaciones

#### Parámetros Requeridos
```json
{
  "area": "MAT|LC|CN|SOC|ING",
  "dificultad": "facil|media|alta",
  "n": 1-5
}
```

#### Límites de Campos (ICFES)
| Campo | Mín | Máx |
|-------|-----|-----|
| contexto | 20 | 1200 |
| pregunta | 10 | 250 |
| opciones | 5 | 180 |
| justificacion | 50 | 450 |
| tags | 1 | 6 |

#### Códigos de Error
```
VALIDATION_ERROR    - Input inválido
GENERATION_FAILED   - Modelo no cumple esquema
INTERNAL_ERROR      - Error del servidor
```

### Ejemplos Completos

Ver documentación detallada en:
- 📄 [API.md](API.md) - Guía de endpoints
- 📚 [API_DEEPDIVE.md](API_DEEPDIVE.md) - Documentación técnica
- 🛡️ [HARDENING_COMPLETE.md](HARDENING_COMPLETE.md) - Seguridad y validaciones

---

## 📁 Estructura del Proyecto

```
AICFES/
├── src/
│   ├── main.ts                          ← Entry point
│   ├── app.module.ts                    ← Root module
│   ├── health/
│   │   └── health.controller.ts         ← Health endpoint
│   ├── items/
│   │   ├── items.controller.ts          ← Item endpoints
│   │   ├── items.module.ts
│   │   ├── services/
│   │   │   ├── item-generator.service.ts  ← Lógica de generación
│   │   │   ├── normalizer.service.ts      ← Limpia output del modelo
│   │   │   └── validators.service.ts      ← Validaciones por área
│   │   └── schemas/
│   │       └── item.schema.ts             ← Zod schema
│   ├── persistence/
│   │   └── persistence.service.ts       ← ORM wrapper
│   └── common/
│       ├── filters/
│       │   └── all-exceptions.filter.ts ← Error handling
│       └── middleware/
│           └── request-id.middleware.ts ← RequestId injection
├── prisma/
│   ├── schema.prisma                    ← Database schema
│   └── migrations/                      ← DB migrations
├── public/
│   ├── index.html                       ← UI frontend (opcional)
│   ├── app.js
│   └── style.css
├── docs/
│   ├── API.md                           ← Guía de endpoints
│   ├── API_DEEPDIVE.md                  ← Documentación técnica
│   └── HARDENING_COMPLETE.md            ← Mejoras de seguridad
├── scripts/
│   └── test-docs.sh                     ← Script de pruebas
├── .env.example
├── package.json
├── tsconfig.json
├── nest-cli.json
└── README.md                            ← Este archivo
```

---

## 🏗️ Arquitectura

### Capas

```
Request
  ↓
[Middleware: RequestId, CORS]
  ↓
[Controller: Validar request]
  ↓
[Service: Lógica de negocio]
  ├─ ItemGeneratorService (genera con OpenAI)
  ├─ NormalizerService (limpia output)
  ├─ ValidatorsService (valida por área)
  └─ PersistenceService (guarda en BD)
  ↓
Response Normalizada { ok, items[], meta, error? }
```

### Flujo de Generación

```
POST /api/items/generate
  ↓
Input Validation (Zod)
  ↓ [Error] → VALIDATION_ERROR
Crear GenerationRequest en BD
  ↓
Llamar OpenAI con prompt mejorado
  ↓
NormalizerService
  ├─ Quitar markdown code blocks
  ├─ Parse JSON
  ├─ Normalizar estructura
  └─ Trimear campos largos
  ↓ [Error] → Retry 1x
Validar con Zod schema
  ↓ [Error] → GENERATION_FAILED
ValidatorsService
  ├─ Distractores por área
  ├─ Respuesta correcta
  └─ Límites de longitud
  ↓ [Error] → GENERATION_FAILED
Guardar items en BD
  ↓
Response { ok: true, items[], meta }
```

### Base de Datos

```
PostgreSQL (Cloud - Aiven)
  ├─ Table: Item
  │  ├─ id, area, dificultad
  │  ├─ plantilla, contexto, pregunta
  │  ├─ opciones, respuesta_correcta
  │  ├─ justificacion, tags, distractores
  │  └─ createdAt
  └─ Table: GenerationRequest
     ├─ requestId, area, status
     ├─ parseStatus, parseError
     ├─ rawModelOutput, itemsGenerated
     └─ createdAt
```

---

## 🔒 Seguridad

### Implementado
- ✅ **Helmet**: Headers HTTP seguros
- ✅ **CORS**: Configurable por origen
- ✅ **Validación Zod**: Schema estricto
- ✅ **Errors**: No expone stack traces
- ✅ **RequestId**: Trazabilidad completa
- ✅ **Rate Limiting Ready**: Preparado para agregar

### Recomendaciones Producción

```typescript
// 1. Autenticación
app.use(new AuthMiddleware());  // JWT o API Key

// 2. CORS restringido
app.enableCors({
  origin: 'https://app.example.com',
  credentials: true
});

// 3. Rate Limiting
import rateLimit from 'express-rate-limit';
app.use(rateLimit({ 
  windowMs: 1 * 60 * 1000,  // 1 minuto
  max: 100                    // 100 requests
}));

// 4. Proteger endpoints de debug
app.use('/api/items/requests/failed', new AdminOnly());
```

---

## 🚢 Deployment

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
CMD ["node", "dist/main.js"]
```

```bash
docker build -t aicfes-api .
docker run -e DATABASE_URL="..." -e OPENAI_API_KEY="..." aicfes-api
```

### Heroku
```bash
git push heroku main
heroku config:set DATABASE_URL="..."
heroku config:set OPENAI_API_KEY="..."
```

### PM2
```bash
npm install pm2 -g
pm2 start dist/main.js --name "aicfes-api"
pm2 save
pm2 startup
```

### Vercel
```bash
# vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "express"
}
```

---

## 👨‍💻 Development

### Scripts Disponibles

```bash
npm run start       # Iniciar servidor
npm run start:dev   # Dev mode con hot-reload
npm run build       # Compilar TypeScript
npm run test        # Ejecutar tests (si existen)
npm run lint        # Lint con ESLint
npm run format      # Format con Prettier
```

### Actualizar Esquema

```bash
# Editar prisma/schema.prisma
npx prisma migrate dev --name <descripcion>
npx prisma studio  # Ver datos
```

### Testing

```bash
# Tests unitarios
npm run test

# Tests e2e
npm run test:e2e

# Cobertura
npm run test:cov
```

---

## 📈 Monitoreo

### Ver Estadísticas
```bash
curl "http://localhost:3000/api/items/requests?limit=100" | jq '.requests | group_by(.parseStatus)'
```

### Logs Estructurados
```bash
# Cada request tiene requestId para correlación
LOG: [requestId: abc123] Generating 3 items for area: MAT
LOG: [requestId: abc123] NormalizerService success
LOG: [requestId: abc123] Items saved to DB
```

### Alertas Recomendadas
- Tasa de error > 10%
- Latencia promedio > 5s
- Requests fallidos creciendo
- Errores de parsing

---

## 🤝 Contributing

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

### Convenciones
- **Commits**: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`
- **Branches**: `feature/nombre`, `fix/nombre`, `docs/nombre`
- **Code Style**: ESLint + Prettier

---

## 📝 Changelog

### v1.0.0 (Enero 2026)
- ✅ MVP completado
- ✅ Generación de ítems ICFES
- ✅ Validación estricta
- ✅ Documentación completa
- ✅ Endpoints de debugging

---

## 📞 Soporte

- 📧 **Email**: support@aicfes.example.com
- 🐛 **Issues**: [GitHub Issues](https://github.com/aicfes/api/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/aicfes/api/discussions)

---

## 📄 Licencia

MIT © 2026 AICFES

Libre para uso comercial y personal. (No hay archivo `LICENSE` en el
repositorio todavía; conviene añadir uno para que esta frase signifique
algo.)

---

## 🙏 Agradecimientos

- NestJS team
- Prisma team
- OpenAI
- PostgreSQL community

---

## 📚 Referencias Útiles

- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Zod Documentation](https://zod.dev)
- [OpenAI API](https://platform.openai.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs)

---

**Última actualización**: 13 de enero de 2026

Hecho con ❤️ por el equipo AICFES

# 2. Configurar .env (ver .env.example)
cp .env.example .env

# 3. Migraciones de base de datos
npx prisma migrate dev

# 4. Iniciar servidor
npm run start:dev

# 5. Abrir en navegador
# http://localhost:3000
```

## 🎨 Interfaz de Usuario

**Acceso**: http://localhost:3000

La UI incluye:
- ✅ Formulario de configuración (área, dificultad, tema, cantidad)
- ✅ Generación en tiempo real con OpenAI
- ✅ Cards profesionales con cada ítem
- ✅ Opciones coloreadas (con highlight de respuesta correcta)
- ✅ Justificación pedagógica
- ✅ Tags de clasificación
- ✅ Tipos de distractores
- ✅ Sección JSON raw copiable
- ✅ Soporte responsive

👉 *(Había un enlace a `UI.md` aquí. Ese archivo no existe en el
repositorio.)*

## 💻 Setup Detallado

1. **Clonar y configurar**:
   ```bash
   git clone <repo>
   cd AICFES
   cp .env.example .env
   ```

2. **Editar `.env`**:
   ```env
   OPENAI_API_KEY=sk-...
   OPENAI_MODEL=gpt-5-mini
   DATABASE_URL=postgres://user:pass@host:port/db
   PORT=3000
   ```

3. **Instalar y migrar**:
   ```bash
   npm install
   npx prisma migrate dev --name init
   ```

4. **Ejecutar**:
   ```bash
   npm run start:dev    # Desarrollo con hot-reload
   npm run build        # Compilar
   npm run start:prod   # Producción
   ```

## 📊 Estructura del Proyecto

```
AICFES/
├── src/
│   ├── main.ts                    # Bootstrap del servidor
│   ├── app.module.ts              # Root module
│   ├── config/env.validation.ts   # Validación de env vars
│   ├── common/
│   │   ├── middleware/request-id.middleware.ts
│   │   ├── filters/all-exceptions.filter.ts
│   │   └── utils/json-extract.ts
│   ├── health/                    # Health check endpoint
│   ├── items/                     # Generación de ítems
│   │   ├── items.controller.ts
│   │   ├── items.module.ts
│   │   ├── dto/generate-request.schema.ts
│   │   ├── schemas/item.schema.ts
│   │   └── services/
│   │       ├── item-generator.service.ts   # Orquestación
│   │       ├── openai.service.ts          # Integración OpenAI
│   │       └── prompt-loader.service.ts   # Carga de prompts
│   └── persistence/               # Base de datos
│       ├── prisma.service.ts
│       ├── persistence.service.ts
│       └── persistence.module.ts
├── prisma/
│   ├── schema.prisma              # Definición de BD
│   └── migrations/                # Historial de cambios
├── public/                        # Archivos estáticos (UI)
│   ├── index.html
│   ├── style.css
│   └── app.js
├── prompts/                       # Prompts para IA
│   ├── MAT/developer.txt
│   ├── MAT/user_template.txt
│   ├── LC/...
│   ├── CN/...
│   ├── SOC/...
│   └── ING/...
├── .env.example
├── package.json
├── tsconfig.json
└── README.md (este archivo)
```

## 🔌 API Endpoints

### Health Check
```bash
curl http://localhost:3000/api/health
```

### Generar Ítems
```bash
POST http://localhost:3000/api/items/generate

# Request
{
  "area": "MAT",           # Requerido: MAT|LC|CN|SOC|ING
  "dificultad": "facil",   # Requerido: facil|media|alta
  "tema": "porcentajes",   # Opcional
  "plantilla": "...",      # Opcional
  "n": 1                   # Opcional (default: 1, max: 5)
}

# Response (n=1) - Objeto único
{
  "area": "MAT",
  "dificultad": "facil",
  "plantilla": "Plantilla porcentajes",
  "contexto": "...",
  "pregunta": "¿Cuántos puntos...",
  "opciones": {
    "A": "30 puntos",
    "B": "31 puntos",
    "C": "45 puntos",
    "D": "29 puntos"
  },
  "respuesta_correcta": "A",
  "justificacion": "...",
  "tags": ["porcentajes", "razonamiento"],
  "distractores": {
    "A": "correcta",
    "B": "error_calculo",
    "C": "interpretacion_parcial",
    "D": "confunde_conceptos"
  }
}

# Response (n>1) - Array
[
  { /* item 1 */ },
  { /* item 2 */ },
  { /* item 3 */ }
]
```

## Database Schema

### PostgreSQL Tables

#### `GenerationRequest`
Tracks each request to generate items. One request can produce multiple items.

| Field | Type | Description |
|-------|------|-------------|
| id | String (CUID) | Primary key |
| requestId | String (unique) | Unique request ID (from middleware) |
| area | Enum (MAT, LC, CN, SOC, ING) | Subject area |
| dificultad | Enum (facil, media, alta) | Difficulty level |
| tema | String (optional) | Topic/theme requested |
| plantilla | String (optional) | Template requested |
| n | Int | Number of items requested |
| status | Enum (PENDING, SUCCESS, ERROR) | Generation status |
| error | String (optional) | Error message if failed |
| items | Relation[] | Generated items (foreign key) |
| createdAt | DateTime | Timestamp of request |
| updatedAt | DateTime | Last update timestamp |

**Indexes**: requestId (unique), status, createdAt

#### `GeneratedItem`
Each question/item generated by the AI. Stores complete ICFES-format items.

| Field | Type | Description |
|-------|------|-------------|
| id | String (CUID) | Primary key |
| requestId | String (FK) | References GenerationRequest |
| area | Enum (MAT, LC, CN, SOC, ING) | Subject area |
| dificultad | Enum (facil, media, alta) | Difficulty level |
| plantilla | String | Template used |
| contexto | Text | Context/scenario of the item |
| pregunta | String | The question being asked |
| opciones | JSON | {A: string, B: string, C: string, D: string} |
| respuesta_correcta | String (A\|B\|C\|D) | Correct answer |
| justificacion | Text | Pedagogical justification |
| tags | JSON | Array of semantic tags (["tag1", "tag2"]) |
| distractores | JSON | {A: tipo_error, B: tipo_error, ...} |
| createdAt | DateTime | Generated timestamp |
| updatedAt | DateTime | Last update timestamp |

**Indexes**: requestId (FK), area, createdAt

**Foreign Key Constraint**: requestId references GenerationRequest.id with CASCADE delete

## API Examples

### Health Check

```bash
curl -X GET http://localhost:3000/api/health
```

Response:
```json
{"ok":true,"model":"gpt-5-mini","ts":"2026-01-13T18:04:38.137Z"}
```

### Generate Single Item (n=1)

Returns a **single JSON object** (NOT an array):

```bash
curl -X POST http://localhost:3000/api/items/generate \
  -H "Content-Type: application/json" \
  -d '{"area":"MAT","dificultad":"facil","n":1}'
```

Response:
```json
{
  "area": "MAT",
  "dificultad": "facil",
  "plantilla": "...",
  "contexto": "...",
  "pregunta": "...",
  "opciones": {"A": "...", "B": "...", "C": "...", "D": "..."},
  "respuesta_correcta": "A",
  "justificacion": "...",
  "tags": ["proporcionalidad", "calculo"],
  "distractores": {"A": "correcta", "B": "error_calculo", "C": "interpretacion_parcial", "D": "confunde_conceptos"}
}
```

### Generate Multiple Items (n>1)

Returns a **JSON array** (NOT wrapped in {items:[...]}):

```bash
curl -X POST http://localhost:3000/api/items/generate \
  -H "Content-Type: application/json" \
  -d '{"area":"SOC","dificultad":"media","n":3}'
```

Response:
```json
[
  {
    "area": "SOC",
    "dificultad": "media",
    ...
  },
  {
    "area": "SOC",
    "dificultad": "media",
    ...
  },
  {
    "area": "SOC",
    "dificultad": "media",
    ...
  }
]
```

### Request Parameters

- **area** (required): MAT, LC, CN, SOC, ING
- **dificultad** (required): facil, media, alta
- **tema** (optional): e.g., "proporcionalidad", "argumentacion"
- **plantilla** (optional): e.g., "problema_practico", "lectura_critica"
- **n** (optional): number of items (default 1, max configurable MAX_ITEMS=5)

## Database Querying (Prisma Studio)

View and manage data in your database:

```bash
npx prisma studio
```

Opens a web UI at http://localhost:5555

## Environment Variables

```env
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5-mini

# Server
PORT=3000
MAX_ITEMS=5
MAX_RETRIES=2
BODY_LIMIT=1mb
CORS_ORIGIN=*

# Database
DATABASE_URL=postgres://user:password@host:port/database?sslmode=require
```

## Architecture

```
src/
├── persistence/           # Database integration
│   ├── prisma.service.ts
│   ├── persistence.service.ts
│   └── persistence.module.ts
├── items/                 # Item generation
│   ├── services/
│   │   ├── item-generator.service.ts
│   │   ├── openai.service.ts
│   │   └── prompt-loader.service.ts
│   ├── items.controller.ts
│   └── items.module.ts
└── health/                # Health check
```

**Data Flow:**
1. POST /api/items/generate
2. RequestIdMiddleware generates unique requestId
3. ItemsController validates input
4. PersistenceService creates GenerationRequest record
5. ItemGeneratorService calls OpenAI API
6. If successful, PersistenceService saves GeneratedItems
7. Response is returned to client (object if n=1, array if n>1)

## Notes

- Each generation request is tracked with a unique `requestId`
- All generated items are persisted to PostgreSQL
- Database schema uses JSON columns for flexible storage (opciones, tags, distractores)
- Automatic retry with corrective prompts if AI output is invalid
- CAS DELETE on GenerationRequest → automatically deletes associated GeneratedItems
