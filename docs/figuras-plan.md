# Figuras para las preguntas — plan

## El problema

Una parte grande del Saber 11 no se puede plantear solo con texto. Un
ángulo necesita el triángulo dibujado, una lectura de gráfica necesita
la gráfica, un circuito necesita el circuito. Hoy la plataforma genera
solo texto, así que esas preguntas no se pueden hacer bien.

## Por qué no generar una imagen por pregunta

Generar cada figura con un modelo de imagen falla por tres razones, y
la primera es la que importa:

1. **Los modelos de imagen no saben dibujar diagramas exactos.** Ponen
   «4 m» donde el enunciado dice 3, o un ángulo que no corresponde. En
   una pregunta de geometría eso no es un defecto estético: la pregunta
   queda mal y el estudiante aprende algo falso.
2. **Cuesta.** Una imagen por pregunta, por cada generación.
3. **Es lento.** Segundos por imagen, en el camino de una sesión.

## La decisión: figuras paramétricas en SVG

Una plantilla no es una imagen: es una función que recibe los números
de la pregunta y devuelve el dibujo exacto.

```
escaleraApoyada({ altura: 4, base: 3 })
  → SVG con el ángulo calculado desde los catetos
```

El modelo **no dibuja**. Elige qué plantilla usa y con qué valores, que
es exactamente lo que un modelo hace bien, y queda declarado en el
mismo JSON Schema que ya restringe la generación.

| | Imagen generada | Imagen + texto encima | **SVG paramétrico** |
|---|---|---|---|
| Costo por figura | alto | 0 | **0** |
| Números correctos | no garantizado | pegados, descuadran | **derivados** |
| Variar el ángulo | no | no | **sí** |
| Peso | ~200 KB | ~80 KB | **~2 KB** |
| Nitidez | fija | fija | **cualquier tamaño** |
| Dependencias | API externa | herramienta de imagen | **ninguna** |

## Catálogo inicial

Doce plantillas cubren la mayoría del material. El orden es por cuánto
aparecen en los simulacros oficiales.

### Matemáticas y Física
1. `trianguloRectangulo` — catetos, hipotenusa, ángulo. La escalera
   apoyada en la pared, la rampa, la sombra del poste: todas son esta.
2. `figuraPlana` — rectángulo, círculo, trapecio con sus medidas.
3. `planoCartesiano` — puntos, rectas, parábolas.
4. `graficaBarras` — comparación entre categorías.
5. `graficaLineas` — una magnitud en el tiempo.
6. `circuitoSimple` — pila, resistencias, bombillo.
7. `cuerpoLibre` — un bloque y las fuerzas sobre él.

### Ciencias Naturales
8. `tablaDatos` — resultados de un experimento.
9. `diagramaProceso` — ciclos, cadenas, fases.

### Sociales y Lectura Crítica
10. `graficaCircular` — proporciones de una población.
11. `lineaTiempo` — hechos en orden.
12. `mapaEsquematico` — regiones sin detalle geográfico.

## Cómo encaja con lo que ya existe

1. El esquema del ítem gana un campo `figura` opcional:
   `{ plantilla: 'trianguloRectangulo', parametros: { ... } }`.
2. El JSON Schema declara las plantillas y sus parámetros, así que el
   modelo solo puede pedir una que exista con valores del tipo correcto.
3. Un validador comprueba que los parámetros sean coherentes **antes**
   de aceptar el ítem: un triángulo con hipotenusa menor que un cateto
   se rechaza, igual que hoy se rechaza una respuesta equivocada.
4. El SVG se genera al servir la pregunta, no al guardarla, así que
   corregir una plantilla arregla todas las preguntas que la usan.

## Qué hace falta para empezar

Lo único que no puedo sacar yo: **el material oficial**. Con una muestra
de simulacros reales puedo contar qué figuras aparecen y con qué
frecuencia, y ordenar el catálogo por lo que de verdad se usa en lugar
de por lo que supongo.

Sin ese material igual se puede arrancar por `trianguloRectangulo` y
`planoCartesiano`, que aparecen en cualquier prueba de matemáticas.
