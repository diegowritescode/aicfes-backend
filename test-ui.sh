#!/bin/bash

# Script de prueba de la UI y API

echo "🧪 Iniciando pruebas de la UI y API..."
echo "=================================="

# Test 1: Verificar que el servidor está funcionando
echo -e "\n✅ Test 1: Servidor en ejecución"
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "   ✓ Health check PASS"
else
    echo "   ✗ Health check FAIL"
    exit 1
fi

# Test 2: Verificar que HTML se sirve
echo -e "\n✅ Test 2: UI HTML se sirve"
if curl -s http://localhost:3000/ | grep -q "Generador ICFES"; then
    echo "   ✓ HTML PASS"
else
    echo "   ✗ HTML FAIL"
    exit 1
fi

# Test 3: Verificar que CSS se sirve
echo -e "\n✅ Test 3: CSS se sirve"
if curl -s http://localhost:3000/style.css | grep -q "root"; then
    echo "   ✓ CSS PASS"
else
    echo "   ✗ CSS FAIL"
    exit 1
fi

# Test 4: Verificar que JS se sirve
echo -e "\n✅ Test 4: JavaScript se sirve"
if curl -s http://localhost:3000/app.js | grep -q "API_BASE_URL"; then
    echo "   ✓ JS PASS"
else
    echo "   ✗ JS FAIL"
    exit 1
fi

# Test 5: Generar un ítem MAT simple
echo -e "\n✅ Test 5: Generación de ítem MAT"
RESPONSE=$(curl -s -X POST http://localhost:3000/api/items/generate \
  -H "Content-Type: application/json" \
  -d '{
    "area": "MAT",
    "dificultad": "facil",
    "tema": "números enteros",
    "n": 1
  }')

if echo "$RESPONSE" | grep -q '"area":"MAT"'; then
    echo "   ✓ Generación MAT PASS"
    echo "   Respuesta: $(echo "$RESPONSE" | head -c 100)..."
else
    echo "   ✗ Generación MAT FAIL"
    echo "   Respuesta: $RESPONSE"
    exit 1
fi

# Test 6: Generar 2 ítems SOC
echo -e "\n✅ Test 6: Generación de array (n=2) SOC"
RESPONSE=$(curl -s -X POST http://localhost:3000/api/items/generate \
  -H "Content-Type: application/json" \
  -d '{
    "area": "SOC",
    "dificultad": "media",
    "n": 2
  }')

if echo "$RESPONSE" | grep -q '\[' && echo "$RESPONSE" | grep -q '"area":"SOC"'; then
    echo "   ✓ Generación SOC (array) PASS"
    # Contar items en el array
    COUNT=$(echo "$RESPONSE" | grep -o '"area":"SOC"' | wc -l)
    echo "   Items generados: $COUNT"
else
    echo "   ✗ Generación SOC (array) FAIL"
    echo "   Respuesta: $RESPONSE"
    exit 1
fi

echo -e "\n=================================="
echo "✅ TODAS LAS PRUEBAS PASARON"
echo "=================================="
echo ""
echo "🌐 UI disponible en: http://localhost:3000"
echo "📖 Documentación en: UI.md"
echo ""
