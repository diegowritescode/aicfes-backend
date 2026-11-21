# Conteo de figuras en el material oficial

Muestra revisada visualmente sobre 243 cuadernillos oficiales
(`07. ICFES FILTRADOS`), 763 páginas renderizadas, años 2012 a 2023.

## Lo que cambió respecto al plan inicial

**Las figuras se concentran por área, no se reparten.** La suposición
era que todas las áreas necesitaban figuras por igual. No es así:

| Área | Figuras observadas |
|---|---|
| Matemáticas | altas — tablas, gráficas, geometría |
| Ciencias Naturales | altas — gráficas, montajes, tablas |
| Sociales y Ciudadanas | **ninguna en la muestra** |
| Lectura Crítica | ninguna esperada: el texto es el estímulo |

Tres páginas de Sociales de años distintos (2017, 2020, 2023) no
tenían una sola figura. Eso retira `mapaEsquematico` y `lineaTiempo`
de la primera tanda: estaban en el plan por suposición, no por uso.

## Hallazgo que el plan no previó

En Biología 2010, pregunta 108, **las cuatro opciones de respuesta son
gráficas**: el estudiante elige cuál curva describe el fenómeno. La
figura no acompaña al enunciado, acompaña a cada opción.

Eso significa que el campo `figura` no puede ser uno solo por ítem: las
opciones necesitan poder llevar la suya. Es un cambio al esquema, no a
las plantillas.

## Confirmaciones

- **El triángulo rectángulo se repite con otros nombres.** 2018
  Calendario A pregunta 35: una grúa con cuerda y ángulo θ. Misma
  figura que la escalera y la rampa, como preveía el plan.
- **La tabla es la figura más común.** Aparece en Matemáticas 2020 dos
  veces en una página, y en 2018 con imágenes dentro de las celdas.
- **La gráfica de barras aparece tal cual** se implementó, incluso en
  un ítem que pide detectar un error en cómo fue dibujada.

## Orden de trabajo, revisado

Hecho:
1. `trianguloRectangulo` — confirmado en 2018
2. `graficaBarras` — confirmado en 2020
3. `tablaDatos` — la más frecuente

Siguiente, por lo observado:
4. `graficaLineas` — Biología 2010, y como opción de respuesta
5. `planoCartesiano` — Matemáticas
6. `montajeExperimental` — Ciencias Naturales

Descartado de la primera tanda: `mapaEsquematico`, `lineaTiempo`,
`graficaCircular`. No aparecieron en la muestra.

## Advertencia sobre el material

`04. SIMULACROS` incluye material que **no es ICFES colombiano**: hay
cuadernillos peruanos con cinco opciones (A–E) en lugar de cuatro. Sirve
como práctica, pero no para medir qué figuras usa el Saber 11.
