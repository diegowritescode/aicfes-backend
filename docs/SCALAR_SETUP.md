# 📋 Configuración y Setup del Proyecto

> **⚠️ El título está mal. Verificado el 22 nov 2026.**
>
> Dice "Scalar" y describe Swagger UI. No hay ninguna dependencia
> `@scalar` en el proyecto; la documentación la sirve `@nestjs/swagger`
> en `/api/docs`, configurado en `src/main.ts`.
>
> Nota de seguridad: esa ruta está **pública en producción**, lo que
> expone el mapa completo de endpoints.

## 🔧 Stack Actual

- **Backend**: NestJS 10.x
- **Lenguaje**: TypeScript
- **Base de Datos**: PostgreSQL con Prisma ORM
- **Validación**: Zod
- **Documentación**: Swagger UI + OpenAPI JSON
- **Modelo IA**: GPT-5-mini (OpenAI)

## 📚 Documentación Disponible en `/docs`

- [API.md](API.md) - Guía de endpoints
- [API_DEEPDIVE.md](API_DEEPDIVE.md) - Documentación técnica
- [HARDENING_COMPLETE.md](HARDENING_COMPLETE.md) - Mejoras de seguridad

## 🚀 URLs de Documentación

- **Swagger UI**: `http://localhost:3000/docs`
- **OpenAPI JSON**: `http://localhost:3000/docs-json`

## 📝 Primeros Pasos

Ver [README.md](../README.md) en la raíz para instrucciones completas de:
- Instalación
- Configuración de variables de entorno
- Inicialización de base de datos
- Desarrollo y producción

## ✨ Características Principales

✅ Generación de ítems ICFES con IA
✅ Validación estricta con Zod
✅ Debugging y auditoría completa
✅ Documentación profesional
✅ Escalable y production-ready