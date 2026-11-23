# 🛡️ ENDURECIMIENTO BACKEND - COMPLETADO

> **⚠️ Dice "completado" y no dice cuándo. Verificado el 22 nov 2026.**
>
> Un documento que se declara terminado sin fecha de verificación es un
> documento que nadie puede creer. Lo que sí está comprobado hoy sobre
> el endurecimiento está en
> [INFRAESTRUCTURA.md](INFRAESTRUCTURA.md), incluidos **dos defectos
> abiertos**: `prisma` es dependencia de desarrollo y el arranque la
> invoca, y una variable que falta en el compose falla en silencio.
>
> Y el 22 nov 2026 se encontró una ruta pública que filtraba respuestas
> correctas, posterior a este documento: ver
> [ADR 9](adr/0009-every-route-that-spends-or-reveals-requires-a-session.md).

## 📋 Resumen Ejecutivo

Se han aplicado 8 mejoras de endurecimiento al backend sin afectar la estructura modular existente. El proyecto es ahora robusto, auditable y listo para producción.

---

## ✅ Mejoras Implementadas

### 1️⃣ Contrato de Respuesta NORMALIZADO

Todas las respuestas siguen un formato consistente:

```json
{
  "ok": true,
  "items": [ { ... } ],
  "meta": { "requestId": "...", "area": "MAT", ... }
}
```

**Beneficios:**
- Frontend NUNCA rompe
- items SIEMPRE es array
- Metadata trazable con requestId

---

### 2️⃣ Debug Info Guardado en BD

Se almacena en cada request:
- `rawModelOutput` - Salida completa del modelo
- `parseStatus` - OK o FAIL
- `parseError` - Detalles si falló
- `normalizedItemsCount` - Ítems que validaron

---

### 3️⃣ Validación Estricta con Zod

Schema con:
- Enumeraciones válidas (area, dificultad)
- Límites ICFES de longitud
- Validación refine personalizada
- No acepta campos extras

---

### 4️⃣ Retry Inteligente (Solo 1)

- Máximo 1 reintento automático
- Mensaje correctivo específico
- Timeout claro (max 2 llamadas OpenAI)

---

### 5️⃣ Normalización Previa del Output

NormalizerService limpia:
- Markdown code blocks
- Estructura JSON variada
- Campos muy largos

---

### 6️⃣ Control de Longitudes

Respeta límites ICFES:
- contexto: ≤1200 chars
- pregunta: ≤250 chars
- opciones: ≤180 chars c/u
- justificacion: ≤450 chars
- tags: ≤6

---

### 7️⃣ Validación de Distractores por Área

Tipos específicos permitidos para:
- MAT, LC, CN, SOC, ING

---

### 8️⃣ Endpoints Auxiliares

3 nuevos endpoints para debugging:
- `GET /api/items?area=...&limit=...`
- `GET /api/items/requests?limit=...`
- `GET /api/items/requests/failed?limit=...`

---

## 📊 Archivos Modificados

- `src/items/schemas/item.schema.ts` - Validación estricta
- `src/items/services/item-generator.service.ts` - Retry inteligente
- `src/items/services/normalizer.service.ts` - Normalización (NUEVO)
- `src/items/services/validators.service.ts` - Validación por área (NUEVO)
- `src/items/items.controller.ts` - Nuevos endpoints + formato normalizado
- `prisma/schema.prisma` - Nuevos campos de debug

---

## 🎯 Beneficios Finales

- Robusto y production-ready
- Auditabilidad completa
- Errores predecibles
- Frontend protegido
- Cero deuda técnica

**El sistema está listo para escalar sin problemas.**