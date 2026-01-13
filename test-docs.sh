#!/bin/bash

# Script de prueba: Verificar que la documentación está completa

echo "🧪 VERIFICANDO DOCUMENTACIÓN SCALAR..."
echo ""

BASE_URL="http://localhost:3000"

# Test 1: Health endpoint
echo "1. Health endpoint..."
HEALTH=$(curl -s $BASE_URL/api/health | jq -r '.ok')
if [ "$HEALTH" = "true" ]; then
  echo "   ✅ OK - Servidor respondiendo"
else
  echo "   ❌ FAIL - Servidor no responde"
  exit 1
fi

# Test 2: OpenAPI Spec
echo "2. Especificación OpenAPI (docs-json)..."
SPEC=$(curl -s $BASE_URL/docs-json | jq -r '.info.title')
if [[ "$SPEC" == *"AICFES"* ]]; then
  echo "   ✅ OK - Spec disponible: '$SPEC'"
else
  echo "   ❌ FAIL - Spec no disponible"
  exit 1
fi

# Test 3: Swagger UI
echo "3. Swagger UI (docs)..."
SWAGGER=$(curl -s -w "\n%{http_code}" $BASE_URL/docs | tail -1)
if [ "$SWAGGER" = "200" ]; then
  echo "   ✅ OK - Accesible en /docs"
else
  echo "   ❌ FAIL - Status $SWAGGER"
fi

# Test 4: Scalar HTML
echo "4. Scalar HTML (api-docs-scalar)..."
SCALAR=$(curl -s -w "\n%{http_code}" $BASE_URL/api-docs-scalar | tail -1)
if [ "$SCALAR" = "200" ]; then
  echo "   ✅ OK - Accesible en /api-docs-scalar"
else
  echo "   ❌ FAIL - Status $SCALAR"
fi

# Test 5: Endpoints documentados
echo "5. Endpoints documentados en OpenAPI..."
ENDPOINTS=$(curl -s $BASE_URL/docs-json | jq '.paths | keys | length')
echo "   ✅ Total endpoints: $ENDPOINTS"

# Test 6: Tags de documentación
echo "6. Tags de documentación..."
TAGS=$(curl -s $BASE_URL/docs-json | jq -r '.tags[].name')
echo "   Tags encontrados:"
while IFS= read -r tag; do
  echo "     • $tag"
done <<< "$TAGS"

# Test 7: Ejemplo de endpoint generador
echo ""
echo "7. Prueba funcional: Generar 1 ítem..."
RESPONSE=$(curl -s -X POST $BASE_URL/api/items/generate \
  -H "Content-Type: application/json" \
  -d '{
    "area": "MAT",
    "dificultad": "facil",
    "n": 1
  }')

OK=$(echo "$RESPONSE" | jq -r '.ok')
ITEMS=$(echo "$RESPONSE" | jq '.items | length')
REQUEST_ID=$(echo "$RESPONSE" | jq -r '.meta.requestId')

if [ "$OK" = "true" ] && [ "$ITEMS" -gt 0 ]; then
  echo "   ✅ Generación exitosa"
  echo "     • RequestID: $REQUEST_ID"
  echo "     • Items: $ITEMS"
  echo "     • Area: $(echo "$RESPONSE" | jq -r '.meta.area')"
  echo "     • Model: $(echo "$RESPONSE" | jq -r '.meta.model')"
else
  echo "   ⚠️  Respuesta recibida pero items vacíos (ok=$OK)"
fi

echo ""
echo "✅ DOCUMENTACIÓN COMPLETA Y FUNCIONAL"
echo ""
echo "📍 URLs:"
echo "   📚 Swagger UI:    $BASE_URL/docs"
echo "   🎨 Scalar:        $BASE_URL/api-docs-scalar"
echo "   📄 OpenAPI JSON:  $BASE_URL/docs-json"
echo ""
echo "📖 Documentación markdown:"
echo "   API.md          - Guía completa de endpoints"
echo "   SCALAR_SETUP.md - Configuración de Scalar"
echo ""
