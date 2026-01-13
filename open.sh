#!/bin/bash

# Script para abrir la interfaz en el navegador predeterminado

echo "🌐 Abriendo interfaz en navegador..."
echo "   http://localhost:3000"
echo ""
echo "Si el navegador no abre automáticamente, copia y pega la URL anterior."
echo ""

# Detectar SO y abrir navegador
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    open http://localhost:3000
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    xdg-open http://localhost:3000 &
else
    # Windows (Git Bash)
    start http://localhost:3000
fi

echo "✅ Interfaz abierta"
echo ""
echo "Próximos pasos:"
echo "1. Selecciona Área y Dificultad"
echo "2. (Opcional) Ingresa Tema"
echo "3. Click en: 🪄 Generar Ítems"
echo "4. Espera a que genere (5-10 seg)"
echo "5. Scroll abajo para ver JSON raw"
echo "6. Click en: 📋 Copiar JSON"
echo ""
