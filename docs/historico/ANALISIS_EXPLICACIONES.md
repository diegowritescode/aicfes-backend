# 📋 ANÁLISIS EXHAUSTIVO: IMPLEMENTAR "EXPLICACIONES POR OPCIÓN"

## 🎯 OBJETIVO
Agregar un nuevo campo `explicaciones` que contenga mensajes personalizados para cada opción (A, B, C, D), explicando por qué es correcta o incorrecta.

---

## 📊 FLUJO ACTUAL vs NUEVO

### FLUJO ACTUAL (Sin Explicaciones)
```
Frontend: n=5
    ↓
POST /api/items/generate
    ↓
ItemsController: valida, limita, pasa a generator
    ↓
ItemGeneratorService: 
    - Crea prompt para OpenAI
    - OpenAI retorna JSON con 5 items
    - Normaliza y valida
    ↓
Guardado en BD: campos existentes solo
    ↓
Frontend recibe: {pregunta, opciones, respuesta_correcta, justificacion...}
    ↓
Usuario elige opción
    ↓
Frontend: Evalúa si es correcta usando respuesta_correcta
    ↓
PROBLEMA: No hay explicación personalizada
```

### FLUJO NUEVO (Con Explicaciones)
```
Frontend: n=5
    ↓
POST /api/items/generate
    ↓
ItemsController: valida, limita, pasa a generator
    ↓
ItemGeneratorService: 
    - Crea prompt MEJORADO para OpenAI (pide explicaciones)
    - OpenAI retorna JSON con 5 items + explicaciones
    - Normaliza y valida explicaciones
    ↓
Guardado en BD: campos existentes + explicaciones
    ↓
Frontend recibe: {..., explicaciones: {A: "...", B: "...", C: "...", D: "..."}}
    ↓
Usuario elige opción
    ↓
Frontend: obtiene explicaciones[opcionElegida] ← CERO latencia
    ↓
SOLUCIÓN: Feedback inmediato y personalizado
```

---

## 🔧 CAMBIOS REQUERIDOS

### 1️⃣ SCHEMA ZOID (TypeScript - Validación)

**Archivo:** `src/items/schemas/item.schema.ts`

#### CAMBIO: Agregar schema de explicaciones
```typescript
// NUEVO SCHEMA (después de ErrorTypeSchema)
export const ExplicacionesSchema = z.object({
  A: z.string().min(30, 'Explicación A muy corta').max(300, 'Explicación A muy larga'),
  B: z.string().min(30, 'Explicación B muy corta').max(300, 'Explicación B muy larga'),
  C: z.string().min(30, 'Explicación C muy corta').max(300, 'Explicación C muy larga'),
  D: z.string().min(30, 'Explicación D muy corta').max(300, 'Explicación D muy larga'),
}).strict();

// MODIFICADO: ItemSchema
export const ItemSchema = z
  .object({
    // ... campos existentes ...
    justificacion: z.string().min(50, 'Justificación muy corta').max(450, 'Justificación muy larga'),
    tags: z.array(z.string().min(2).max(50)).min(1, 'Al menos 1 tag').max(6, 'Máximo 6 tags'),
    distractores: ErrorTypeSchema,
    
    // NUEVO CAMPO
    explicaciones: ExplicacionesSchema,
  })
```

#### ANTES:
```typescript
export const ItemSchema = z.object({
  area: ...,
  dificultad: ...,
  plantilla: ...,
  contexto: ...,
  pregunta: ...,
  opciones: OptionSchema,
  respuesta_correcta: ...,
  justificacion: ...,
  tags: ...,
  distractores: ErrorTypeSchema,
}).strict()
```

#### DESPUÉS:
```typescript
export const ItemSchema = z.object({
  area: ...,
  dificultad: ...,
  plantilla: ...,
  contexto: ...,
  pregunta: ...,
  opciones: OptionSchema,
  respuesta_correcta: ...,
  justificacion: ...,
  tags: ...,
  distractores: ErrorTypeSchema,
  explicaciones: ExplicacionesSchema,  // ← NUEVO
}).strict()
```

---

### 2️⃣ BASE DE DATOS (Prisma)

**Archivo:** `prisma/schema.prisma`

#### CAMBIO: Agregar columna `explicaciones` a `GeneratedItem`

#### ANTES:
```prisma
model GeneratedItem {
  id                 String   @id @default(cuid())
  generationRequest  GenerationRequest @relation(...)
  requestId          String
  area               Area
  dificultad         Dificultad
  plantilla          String
  contexto           String   @db.Text
  pregunta           String   @db.Text
  opciones           Json     // {A: string, B: string, C: string, D: string}
  respuesta_correcta String
  justificacion      String   @db.Text
  tags               Json     // array of strings
  distractores       Json     // {A: string, B: string, ...}
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  @@index([requestId])
}
```

#### DESPUÉS:
```prisma
model GeneratedItem {
  id                 String   @id @default(cuid())
  generationRequest  GenerationRequest @relation(...)
  requestId          String
  area               Area
  dificultad         Dificultad
  plantilla          String
  contexto           String   @db.Text
  pregunta           String   @db.Text
  opciones           Json     // {A: string, B: string, C: string, D: string}
  respuesta_correcta String
  justificacion      String   @db.Text
  tags               Json     // array of strings
  distractores       Json     // {A: string, B: string, ...}
  explicaciones      Json     // {A: "Explicación...", B: "...", C: "...", D: "..."} ← NUEVO
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  @@index([requestId])
}
```

#### NECESITA MIGRATION:
```bash
npx prisma migrate dev --name add_explicaciones_to_generated_item
```

---

### 3️⃣ PROMPTS (OpenAI - Developer Instructions)

**Archivos:** 
- `prompts/MAT/developer.txt`
- `prompts/LC/developer.txt`
- `prompts/CN/developer.txt`
- `prompts/SOC/developer.txt`
- `prompts/ING/developer.txt`

#### CAMBIO: Agregar sección de EXPLICACIONES al final

Se agrega ANTES de "FORMATO DE SALIDA":

```plaintext
SECCIÓN NUEVA - EXPLICACIONES POR OPCIÓN (CRÍTICO):

La opción correcta DEBE incluir "explicaciones" objeto:
{
  "explicaciones": {
    "A": "Explicación breve...",
    "B": "Explicación breve...",
    "C": "Explicación breve...",
    "D": "Explicación breve..."
  }
}

REGLAS PARA EXPLICACIONES:
1) A (respuesta_correcta): 
   - Comienza con "✅ Correcta porque..."
   - Explica el razonamiento correcto (30-300 caracteres)
   - Usa lenguaje claro y pedagógico
   - Ejemplo: "✅ Correcta porque 5 + 3 = 8, aplicando la suma de números enteros positivos"

2) B, C, D (respuestas_incorrectas):
   - Comienzan con "❌ Incorrecta porque..."
   - Explica el error conceptual específico (30-300 caracteres)
   - Relaciona con el tipo_error del distractor
   - Ejemplo: "❌ Incorrecta porque confunde la multiplicación con la suma"

3) Longitud: Mínimo 30 caracteres, máximo 300 caracteres CADA UNA
4) Pedagogía: Explica el ERROR, no critiques al estudiante
5) Referencia justificación: Usa la justificación para inspirar las explicaciones
```

#### UBICACIÓN EN PROMPTS:
Se agrega en CADA archivo `developer.txt` DESPUÉS de la sección "JUSTIFICACIÓN" y ANTES de "FORMATO DE SALIDA".

#### EJEMPLO PARA MAT:
Agregar después de "D) Justificación pedagógica" y antes de "CONTROL DE CALIDAD INTERNO":

```plaintext
E) Explicaciones por opción (CRÍTICO):
   - SIEMPRE incluir "explicaciones": { "A": "...", "B": "...", "C": "...", "D": "..." }
   - A (correcta): "✅ Correcta porque..." (explica por qué funciona)
   - B, C, D (incorrectas): "❌ Incorrecta porque..." (explica el error específico)
   - Mínimo 30 caracteres, máximo 300 caracteres cada una
   - Usa el tipo de distractor para explicar el error
   - Lenguaje pedagógico, no de crítica
```

---

### 4️⃣ PROMPTS - User Template

**Archivo:** `prompts/[AREA]/user_template.txt`

#### CAMBIO: Actualizar ESQUEMA DE SALIDA

#### ANTES (líneas 11-34):
```plaintext
ESQUEMA DE SALIDA OBLIGATORIO:
{
  "area": "{{AREA}}",
  "dificultad": "{{DIFICULTAD}}",
  "plantilla": "string",
  "contexto": "string",
  "pregunta": "string",
  "opciones": {
    "A": "string",
    "B": "string",
    "C": "string",
    "D": "string"
  },
  "respuesta_correcta": "A|B|C|D",
  "justificacion": "string",
  "tags": ["string", "string"],
  "distractores": {
    "A": "tipo_error",
    "B": "tipo_error",
    "C": "tipo_error",
    "D": "tipo_error"
  }
}
```

#### DESPUÉS:
```plaintext
ESQUEMA DE SALIDA OBLIGATORIO:
{
  "area": "{{AREA}}",
  "dificultad": "{{DIFICULTAD}}",
  "plantilla": "string",
  "contexto": "string",
  "pregunta": "string",
  "opciones": {
    "A": "string",
    "B": "string",
    "C": "string",
    "D": "string"
  },
  "respuesta_correcta": "A|B|C|D",
  "justificacion": "string",
  "tags": ["string", "string"],
  "distractores": {
    "A": "tipo_error",
    "B": "tipo_error",
    "C": "tipo_error",
    "D": "tipo_error"
  },
  "explicaciones": {
    "A": "Explicación breve de por qué es correcta o incorrecta",
    "B": "Explicación breve de por qué es correcta o incorrecta",
    "C": "Explicación breve de por qué es correcta o incorrecta",
    "D": "Explicación breve de por qué es correcta o incorrecta"
  }
}
```

---

### 5️⃣ SERVICIOS - Normalizer

**Archivo:** `src/items/services/normalizer.service.ts`

#### CAMBIO: Actualizar `trimFieldLengths()`

Se agrega trimming para explicaciones:

#### ANTES:
```typescript
trimFieldLengths(item: any): any {
  const limits = {
    contexto: 1200,
    pregunta: 250,
    opciones_field: 180,
    justificacion: 450,
    tags_count: 6,
  };

  if (item.contexto && item.contexto.length > limits.contexto) {
    item.contexto = item.contexto.substring(0, limits.contexto) + '...';
  }
  // ... más fields ...
  return item;
}
```

#### DESPUÉS:
```typescript
trimFieldLengths(item: any): any {
  const limits = {
    contexto: 1200,
    pregunta: 250,
    opciones_field: 180,
    justificacion: 450,
    explicaciones_field: 300,  // ← NUEVO
    tags_count: 6,
  };

  if (item.contexto && item.contexto.length > limits.contexto) {
    item.contexto = item.contexto.substring(0, limits.contexto) + '...';
  }
  // ... campos existentes ...
  
  // NUEVO BLOQUE
  if (item.explicaciones) {
    Object.keys(item.explicaciones).forEach(key => {
      if (item.explicaciones[key].length > limits.explicaciones_field) {
        item.explicaciones[key] = item.explicaciones[key].substring(0, limits.explicaciones_field) + '...';
      }
    });
  }
  
  return item;
}
```

---

### 6️⃣ SERVICIOS - Item Generator

**Archivo:** `src/items/services/item-generator.service.ts`

#### CAMBIO: Validación de explicaciones

En la validación del ítem (después de validar distractores):

#### AGREGAR VALIDACIÓN:
```typescript
// Después de validación de distractores
// Validar que explicaciones tienen al menos 4 campos
const explicaciones = validated.explicaciones;
const explicacionesKeys = Object.keys(explicaciones || {});
if (explicacionesKeys.length !== 4 || !['A', 'B', 'C', 'D'].every(k => explicacionesKeys.includes(k))) {
  throw new Error('Explicaciones debe tener exactamente las claves A, B, C, D');
}

// Validar que todas son strings y no están vacías
Object.entries(explicaciones).forEach(([letra, exp]: [string, any]) => {
  if (typeof exp !== 'string' || exp.trim().length === 0) {
    throw new Error(`Explicación ${letra} debe ser un string no vacío`);
  }
});
```

---

### 7️⃣ SERVICIOS - Persistence

**Archivo:** `src/persistence/persistence.service.ts`

#### CAMBIO: Guardar explicaciones en BD

#### ANTES (en saveGeneratedItems):
```typescript
const createdItems = await Promise.all(
  itemsArray.map((item) =>
    this.prisma.generatedItem.create({
      data: {
        requestId,
        area: item.area as Area,
        dificultad: item.dificultad as Dificultad,
        plantilla: item.plantilla,
        contexto: item.contexto,
        pregunta: item.pregunta,
        opciones: item.opciones,
        respuesta_correcta: item.respuesta_correcta,
        justificacion: item.justificacion,
        tags: item.tags,
        distractores: item.distractores,
      },
    })
  )
);
```

#### DESPUÉS:
```typescript
const createdItems = await Promise.all(
  itemsArray.map((item) =>
    this.prisma.generatedItem.create({
      data: {
        requestId,
        area: item.area as Area,
        dificultad: item.dificultad as Dificultad,
        plantilla: item.plantilla,
        contexto: item.contexto,
        pregunta: item.pregunta,
        opciones: item.opciones,
        respuesta_correcta: item.respuesta_correcta,
        justificacion: item.justificacion,
        tags: item.tags,
        distractores: item.distractores,
        explicaciones: item.explicaciones,  // ← NUEVO
      },
    })
  )
);
```

---

### 8️⃣ CONTROLADOR - Response Schema

**Archivo:** `src/items/items.controller.ts`

#### CAMBIO: Actualizar documentación Swagger

En la respuesta del endpoint POST `/api/items/generate`:

#### AGREGAR a propiedades:
```typescript
@ApiResponse({
  status: 200,
  description: 'Respuesta normalizada con ítems generados',
  schema: {
    type: 'object',
    properties: {
      ok: { type: 'boolean' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            area: { type: 'string' },
            dificultad: { type: 'string' },
            plantilla: { type: 'string' },
            contexto: { type: 'string' },
            pregunta: { type: 'string' },
            opciones: { type: 'object' },
            respuesta_correcta: { type: 'string' },
            justificacion: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            distractores: { type: 'object' },
            explicaciones: {  // ← NUEVO
              type: 'object',
              properties: {
                A: { type: 'string' },
                B: { type: 'string' },
                C: { type: 'string' },
                D: { type: 'string' },
              },
            },
          },
        },
      },
      meta: { type: 'object' },
    },
  },
})
```

---

## 📈 TAMAÑO DE CAMBIOS POR ARCHIVO

| Archivo | Cambios | Complejidad |
|---------|---------|------------|
| `item.schema.ts` | +5 líneas (nuevo schema) | ⭐ Bajo |
| `prisma/schema.prisma` | +1 línea | ⭐ Bajo |
| `prompts/MAT/developer.txt` | +12 líneas | ⭐ Bajo |
| `prompts/MAT/user_template.txt` | +6 líneas | ⭐ Bajo |
| `prompts/[LC,CN,SOC,ING]/developer.txt` | +12 líneas c/u | ⭐ Bajo |
| `prompts/[LC,CN,SOC,ING]/user_template.txt` | +6 líneas c/u | ⭐ Bajo |
| `normalizer.service.ts` | +8 líneas | ⭐ Bajo |
| `item-generator.service.ts` | +10 líneas (validación) | ⭐ Bajo |
| `persistence.service.ts` | +1 línea | ⭐ Bajo |
| `items.controller.ts` | +8 líneas (Swagger) | ⭐ Bajo |

**Total de cambios: ~80 líneas en código, ~100 líneas en prompts**

---

## 🚀 ORDEN DE IMPLEMENTACIÓN RECOMENDADO

1. **Paso 1:** Actualizar `item.schema.ts` (ExplicacionesSchema)
2. **Paso 2:** Actualizar `prisma/schema.prisma` y crear migration
3. **Paso 3:** Actualizar todos los `prompts/*/developer.txt` (5 archivos)
4. **Paso 4:** Actualizar todos los `prompts/*/user_template.txt` (5 archivos)
5. **Paso 5:** Actualizar `normalizer.service.ts`
6. **Paso 6:** Actualizar `item-generator.service.ts`
7. **Paso 7:** Actualizar `persistence.service.ts`
8. **Paso 8:** Actualizar `items.controller.ts`
9. **Paso 9:** Rebuild y test

---

## ✅ CHECKLIST FINAL

- [ ] Schema Zod: Agregado ExplicacionesSchema
- [ ] DB Schema: Agregada columna explicaciones
- [ ] Migration Prisma: Creada y ejecutada
- [ ] Prompts MAT: Actualizado developer + template
- [ ] Prompts LC: Actualizado developer + template
- [ ] Prompts CN: Actualizado developer + template
- [ ] Prompts SOC: Actualizado developer + template
- [ ] Prompts ING: Actualizado developer + template
- [ ] Normalizer: Agrega trimming de explicaciones
- [ ] Generator: Valida explicaciones
- [ ] Persistence: Guarda explicaciones
- [ ] Controller: Swagger actualizado
- [ ] Build: Compilación exitosa
- [ ] Test: Genera 1 item y verifica explicaciones

---

## 📝 EJEMPLO DE RESPUESTA FINAL

```json
{
  "ok": true,
  "items": [
    {
      "area": "MAT",
      "dificultad": "media",
      "plantilla": "...",
      "contexto": "...",
      "pregunta": "¿Cuántos litros hay en 5 galones?",
      "opciones": {
        "A": "Aproximadamente 18.9 litros",
        "B": "Aproximadamente 15 litros",
        "C": "Aproximadamente 20 litros",
        "D": "Aproximadamente 25 litros"
      },
      "respuesta_correcta": "A",
      "justificacion": "1 galón equivale a 3.785 litros, por lo tanto 5 × 3.785 = 18.925 ≈ 18.9 litros",
      "tags": ["conversion_unidades", "galones", "litros"],
      "distractores": {
        "A": "correcta",
        "B": "error_calculo",
        "C": "interpretacion_parcial",
        "D": "confunde_conceptos"
      },
      "explicaciones": {
        "A": "✅ Correcta porque 5 galones × 3.785 litros/galón = 18.925 ≈ 18.9 litros",
        "B": "❌ Incorrecta porque divide 15/5 = 3, confundiendo la conversión",
        "C": "❌ Incorrecta porque redondea mal el resultado de la multiplicación",
        "D": "❌ Incorrecta porque suma 20 litros sin aplicar correctamente la tasa de conversión"
      }
    }
  ],
  "meta": {
    "requestId": "...",
    "area": "MAT",
    "dificultad": "media",
    "n": 1,
    "model": "gpt-5-mini"
  }
}
```

---

## 🎯 CONCLUSIÓN

Este cambio es **mínimo y quirúrgico**:
- ✅ No cambia la lógica existente
- ✅ Solo agrega un nuevo campo JSON
- ✅ Compatible con todo lo existente
- ✅ OpenAI puede generar las explicaciones simultáneamente
- ✅ El frontend recibe todo en la respuesta inicial

**Impacto:** +5% latencia de generación, -0% latencia de feedback frontend, +~2% costo OpenAI
