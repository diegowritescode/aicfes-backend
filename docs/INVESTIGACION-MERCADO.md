# Mercado de preparación Saber 11 (ICFES) en Colombia — datos verificados
**Investigación: 22 nov 2026.** Cada cifra lleva URL. Lo no publicado está marcado explícitamente como tal, nunca estimado. Todo lo marcado "verificado en primaria" se obtuvo abriendo el PDF o fetcheando el HTML de la fuente, no de resúmenes de buscador.

---

## 1. TAMAÑO Y CALENDARIO

### 1.1 Cuántos presentan Saber 11 al año — serie oficial ICFES

**Calendario A, evaluados por año** (Icfes, *Doce años del examen Saber 11.º*, ago 2026, Figura 1 p. 4):

| Año | Evaluados | | Año | Evaluados |
|---|---|---|---|---|
| 2014 | 463.722 | | 2020 | 457.214 |
| 2015 | 459.028 | | 2021 | 486.276 |
| 2016 | 474.527 | | 2022 | 488.130 |
| 2017 | 469.835 | | 2023 | **507.387** |
| 2018 | 467.490 | | 2024 | 494.458 |
| 2019 | 467.413 | | **2025** | **489.880** |

https://www.icfes.gov.co/wp-content/uploads/2026/08/NOTA-POLITICA-Doce-an%CC%83os-del-examen-Saber-11.o-4.pdf

**La demanda es plana desde 2016.** Oscila entre 457k y 507k sin tendencia. No es un mercado que crezca por volumen; solo por penetración o por precio.

**Aplicación del 26 jul 2026 (calendario A):** el ICFES citó **más de 650.000 personas** en 1.770 puntos de aplicación en 570 municipios — pero esa cifra **mezcla Saber 11 + Pre Saber + Validación**. Desglose de prensa: ~603.000 Saber 11 + ~50.000 Pre Saber (https://www.infobae.com/colombia/2026/07/28/resultados-icfes-saber-11-calendario-a-2026-fechas-clave-y-cuando-consultar-segun-el-calendario-oficial/).
⚠️ **No existe un boletín oficial del ICFES con la cifra definitiva de evaluados 2026**, y **no existe Informe Nacional de Resultados Saber 11 de 2025** — el último completo es el de 2024.
⚠️ **Discrepancia a no mezclar:** evaluados 2024 son 498.583 según el informe nacional y 494.458 según la nota de 12 años. Ambas son del ICFES con criterios de inclusión distintos. No combines las dos series.
❌ **No publicado:** el total calendario A+B en una sola cifra. La serie del ICFES es solo calendario A; los conteos de B están en una imagen ráster sin capa de texto.

### 1.2 Fechas 2027 — **EL ICFES NO LAS HA PUBLICADO**

Esto es el hallazgo más importante de esta sección y conviene decirlo sin rodeos. **Verifiqué directamente la página oficial de calendarios del ICFES dos veces hoy:** https://www.icfes.gov.co/web/guest/calendarios-de-aplicacion

Lista 9 calendarios. Ninguno es de Saber 11 2027. La **única** fecha de 2027 en toda la página es "resultados individuales 19 feb 2027" del Saber Pro/TyT del segundo semestre de 2026.

**Lo que SÍ es oficial (ciclo 2026, base de referencia):**

| | Calendario B 2026 | Calendario A 2026 |
|---|---|---|
| Registro ordinario | 4 nov 2025 – 16 ene 2026 | 9 mar – 12 may 2026 |
| Registro extraordinario | — | 14 – 22 may 2026 |
| Citación | 27 feb 2026 | 10 jul 2026 |
| **Examen** | **dom 15 mar 2026** | **dom 26 jul 2026** |
| Resultados | 15 may 2026 | 25 sep 2026 |

PDFs oficiales: [calendario A](https://www.icfes.gov.co/wp-content/uploads/2026/05/calendario-2026-11A-v2.pdf) · [calendario B](https://www.icfes.gov.co/wp-content/uploads/2025/12/calendario-2026-11B-vf02.pdf)

**Fechas 2027 que circulan — TODAS son proyecciones de terceros, ninguna oficial.** Universate y otros dan examen calendario B el **domingo 14 de marzo de 2027** y registro del 3 nov al 18 dic 2026, etiquetándolo ellos mismos como tentativo (https://universate.co/pruebas-icfes-saber/prueba-icfes-calendario-b). **No las uses como dato.**

**Consecuencia para el producto, y es incómoda:** si el registro del calendario B 2027 sigue el patrón de 2026, **esa ventana ya está abierta o a punto de cerrarse** (el ciclo anterior abrió el 4 de noviembre). La temporada alta de demanda del calendario B de 2027 es **ahora mismo**, y el examen caería a mediados de marzo. El calendario A — el 80% del mercado — tiene su pico de preparación entre marzo y julio.

### 1.3 Distribución: público/privado y urbano/rural

**Grado 11, matrícula 2025 — MEN/SIMAT, dataset oficial de Datos Abiertos** `ngw5-c5nw`:

| Sector | Estudiantes | % |
|---|---|---|
| **Oficial (público)** | **407.419** | 78,2% |
| **No oficial (privado)** | **113.882** | 21,8% |
| Total | 521.301 | 100% |

| Zona | Estudiantes | % |
|---|---|---|
| **Urbana** | **424.685** | 81,5% |
| **Rural** | **96.616** | 18,5% |

**El cruce, que es el número que más importa:**

| | Urbana | Rural |
|---|---|---|
| Oficial | 318.323 | 89.096 |
| **No oficial** | **106.362** | 7.520 |

https://www.datos.gov.co/Educaci-n/MEN_MATRICULA_EN_EDUCACION_EN_PREESCOLAR-B-SICA-Y-/ngw5-c5nw
Query reproducible: `https://www.datos.gov.co/resource/ngw5-c5nw.json?$select=sector,sum(total_matricula)&$where=anno_inf=2025 AND grado='Once'&$group=sector`
Validación de que es la serie SIMAT real: el total nacional 2024 del dataset suma 9.543.140, idéntico al boletín del MEN. Corroboración independiente DANE EDUC 2024: grado 11 oficial 400.295 + contratada 11.616 / no oficial 96.807 (menor porque DANE excluye CLEI y Modelos Flexibles).

El ICFES corrobora con sus propios evaluados: ~82% urbano / ~18% rural, ~80% oficial / ~20% no oficial. Y **el calendario B es 100% no oficial (privado)** — [Informe Nacional 2024, pp. 10-11](https://www.icfes.gov.co/wp-content/uploads/2025/09/INFORME_NACIONAL_RESULTADOS_SABER_11_2024.pdf).

**La brecha de desempeño está medida por el ICFES:** puntaje global promedio 2025 = 261; **oficial 253 vs no oficial 289 — 36 puntos de diferencia.** Quienes más necesitan preparación son los 407.419 de colegio oficial, y son justamente los que no pueden pagarla (ver §3).

---

## 2. CÓMO SE PREPARAN HOY

### 2.1 Preicfes presencial — 6 academias con precio publicado

| Academia | Ciudad | Lista | **Contado real** | Financiado | Duración publicada |
|---|---|---|---|---|---|
| [Escolaria](https://escolaria.co/preicfes-presencial-medellin/) | Medellín | $1.197.000 | **$797.000** (−33%) | 5 × $189.400 = $947.000 | Cal. B: 20 ene – 20 mar 2027. L-V 1-4pm o sáb 8am-5pm. Carné $12.000 aparte |
| [Preparatoria del Valle](https://preparatoriadelvalle.com/) | Cali | — | **$890.000** | $990.000: inicial $490.000 + 2 × $250.000 | Intensivo Cal. B desde 19 ene 2027, mar-vie 3h |
| [Multipruebas](https://multipruebas.co/preicfes-saber-11-bogota/) | Bogotá | $1.650.000–$1.730.000 | **$830.000–$930.000** | $930.000–$1.030.000 | Vacacional 23 nov–11 dic 2026 (3 sem); sabatino 23 ene–13 mar 2027 |
| [Universate Premium](https://universate.co/Preicfes/) | Bogotá | $1.855.000 | **$1.168.650–$1.502.550** | hasta 6 cuotas (Addi/Sistecrédito) | Sabatino desde 30 ene 2027, 8am-5pm |
| [Escolaria + Preuniv. UNAL](https://escolaria.co/preicfes-preuniversitario-unal-en-medellin/) | Medellín | $1.997.000 | **$1.297.000** (−35%) | 6 × $242.000 | — |
| [Calenda](https://calenda.edu.co/preicfescalendarioa/) | Cali | — | **$1.318.000** | matrícula $300.000 + 5 × $230.000 | desde ago 2026 |

**Rango real del mercado presencial: $797.000 – $1.500.000 de contado.**

Dos hallazgos de modelo, no de precio:
- **El precio de lista es ficticio.** Las 6 venden con descuento permanente y fecha de vencimiento. La familia paga la columna "contado".
- **El crédito cuesta ~19% extra.** Escolaria: $797.000 contado vs $947.000 en cuotas. Preparatoria del Valle: $890.000 vs $990.000. Quien no tiene el efectivo paga la prima.
- **Nadie publica horas totales.** Las 6 publican horario diario y fechas; ninguna publica total de horas. No se puede calcular precio/hora desde fuentes públicas.

❌ **No verificado:** ninguna academia presencial **en Barranquilla** con precio publicado. Ni precios de **Milton Ochoa, Helmer Pardo, Instituto Mentor ni Preicfes Quasar**. Instruimos publica $1.490.000 pero sin indicar ciudad (https://www.instruimos.com/PreicfesPresencial.awp).

### 2.2 Costo del examen mismo — oficial

**Resolución ICFES 000629 del 11 nov 2025** (Diario Oficial 53.303), Art. 1.1, tarifas 2026:

| Categoría | Ordinaria | Extraordinaria |
|---|---|---|
| **Colegio público** | **$72.000** | $108.000 |
| Privado Rango I (pensión ≤$98.000) | $72.000 | $108.000 |
| Privado Rango II–IV | $94.000–$100.000 | $141.000–$151.000 |
| Privado Rango V ($505k–1,5M) | $120.000 | $180.000 |
| Privado Rango VI (>$1,5M) | $143.000 | $215.000 |
| **Bachiller graduado (1ª–4ª vez)** | **$143.000** | $215.000 |
| Bachiller graduado (5ª+) | $430.000 | $646.000 |

Texto: https://normograma.com/documentospdf/icfes2024/compilacion/docs/resolucion_icfes_0629_2025.htm · PDF oficial: https://www.icfes.gov.co/wp-content/uploads/2025/11/20251111-000629-resoluciones.pdf (comprimido/cifrado, no extraíble; cifras verificadas contra el normograma y corroboradas categoría por categoría contra el [comunicado de la Secretaría de Educación del Magdalena](https://sedmagdalena.gov.co/comunicado-no-157-informacion-sobre-la-resolucion-no-000629-del-11-de-noviembre-de-2025-tarifas-de-examenes-de-estado-icfes-para-la-vigencia-2026/)).

**La proporción que define el mercado: el curso presencial cuesta 11 a 21 veces el examen.** $72.000 el examen en colegio público, $797.000–$1.500.000 el curso.

### 2.3 Plataformas web con precio publicado

| Plataforma | Precio (verbatim) | Incluye | URL |
|---|---|---|---|
| **Saber911** | Gratis · **$19.900/mes** · **$149.900/año** (=$12.492/mes, −37%) | Gratis: 1 tema/área + 5 mini simulacros. Pago: 5 áreas, simulacros completos, repaso de fallos, historial. Renovación automática | saber911.com |
| **Lumina Education** | **$50.000** (15 días) · **$220.000** (completo hasta jul 2027) · **$300.000** (+Inglés IA) | Simulacros ilimitados (119-120 preg.), tutor IA "Luna", sesiones de voz en inglés, 10 h/mes clases en vivo. **Pago único, sin renovación** | luminaeducation.app/planes |
| **Preicfes App** | **$450.000** (Oro) · **$800.000** · **$850.000** · **$1.600.000** (Élite) | Oro: 120+ h, 4 meses, 5 clases en vivo/sem + app | preicfes.app/planes |
| **XAVIA** | Curso virtual $450.000 → **$280.000**; pack 3 simulacros $170.000 → **$120.000** | 3 simulacros, informes por competencia, aula virtual | xavia.com.co/servicios/curso-virtual-preicfes/ |
| **Preuniversitario de Colombia** | $1.500.000 → **$975.000–$1.200.000**; financiado $1.600.000 en 5 cuotas | Clases en vivo grabadas, plataforma, fin de semana | preuniversitariodecolombia.edu.co/courses/preicfes-2026-virtual/ |
| **Filadd** | ⚠️ **NO verificado** | Terceros dan cifras contradictorias: $550.000 total / 12 × $45.833; "$37.500/mes" (El Tiempo, **contenido publicitario pagado**); $550.000 (sitio con parámetros de referido, sin fuente). Su web es SPA, precio no extraíble | filadd.com.co/preicfes |

**Sin precio publicado — B2B institucional (declarado explícitamente):**
- **Milton Ochoa** (el nombre más conocido, se autodeclara 25+ años y **1.800+ colegios en 31 departamentos**): **no publica ningún precio**. "La información dependerá de los productos que haya adquirido" su colegio. **No tiene app móvil** (verifiqué: IDs `com.miltonochoa.app` y `co.edu.miltonochoa` dan 404).
- **Seamos Genios**: precio por cotización, "depende del número de estudiantes de grado 11". Primer simulacro $0.
- **Helmer Pardo**: sin precios localizables. B2B.

### 2.4 Apps móviles — Play Store, verificado ficha por ficha

Fetcheé el HTML crudo de cada ficha (`play.google.com/store/apps/details?id=...&hl=es_CO&gl=CO`). Los precios de IAP son el rango literal "por elemento" que publica Play en COP.

| App | Desarrollador | Descargas | Rating | Reseñas | Modelo / precio |
|---|---|---|---|---|---|
| **Mi Icfes** ⭐oficial | ICFES | **100 mil+** | **1.3** | 116 | Gratis, sin IAP ni ads |
| **Pruebas Saber** | CubiDevs | **100 mil+** | 4.4 | **966** | Gratis + anuncios |
| **SIMULACRO PRUEBAS ICFES** | jmaster-urbinez | **100 mil+** | 4.4 | **1,8 mil** | Gratis + anuncios |
| **Pre-ICFES** | — | 50 mil+ | 4.0 | 178 | Gratis + ads. ⚠️abandonada (ago 2025) |
| **Saber Go!** | pasapps | 10 mil+ | 3.5 | 71 | Gratis + ads + IAP |
| **Pre U - Banco de Preguntas** | JhonsiuDev | 10 mil+ | n/d | n/d | IAP $13.500–$36.000 |
| **SaberIA** | Digitalcat | 10 mil+ | 2.3 | 42 | IAP $3.990–$199.900 |
| **PAES Quiz: PreU Ensayos AI** | IoApps | 10 mil+ | n/d | n/d | IAP $13.500–$172.000 (reseña cita "$4.200 semanal") |
| **PreICFES Saber 9-11** | NuPa Apps | 5 mil+ | 4.1 | 7 | IAP $19.900–$149.900 |
| **Supertest** | Supertest Tech | 1 mil+ | n/d | n/d | Gratis, sin IAP |
| **Lumina Pre ICFES** | Lumina Education | 100+ | 4.4 | 5 | Gratis, monetiza en web |
| **Saber Play** | Apps Learn | 100+ | n/d | n/d | IAP $13.000–$80.000 |
| **Aprendo: ICFES Saber 9 y 11** | Aprendo School | 50+ | n/d | n/d | IAP $8.900–$149.900, trial 3 días |
| **Practica ICFES Pro** | corpthia | 10+ | n/d | n/d | **PAGA: $15.000 compra única** |
| **SabrIA / SaberLy / SaberCoach / PreICFES Nandev / Dosis Diaria / Pre Saber Más / Saberes 11** | varios | 1+ a 500+ | — | — | publicadas sep-nov 2026 |

IDs verificados: `co.edu.icfes.miicfes`, `com.cubidevs.pruebassaber`, `simulacro.pruebasicfes`, `app.preicfes.preicfesboyaca`, `com.pasapps.icfessaber`, `com.coder.preu`, `com.digitalcat.sabergo`, `com.academiapreu`, `app.saber911`, `com.supertest.mobile`, `app.luminaeducation.mobile`, `co.saberplay`, `school.aprendo.twa`, `com.corpthia.practicaicfesproif`, `com.sabria.app`, `com.presaberai`, `com.henrydev.sabercoach`, `com.nandev.preicfes`, `com.lasmatesfaciles.dosisdiariasaber11`, `com.chris.sabermas`, `com.universomatematico.saberes11`

**App Store (API iTunes, store CO) — mercado marginal.** Apple no publica descargas. Todas gratis. Conteos de rating de 1 a 9 reseñas: Saber 9-11 (Nupa) 4.33 (6), SaberIA 3.22 (9), Supertest 3.4 (5), Lumina 5.0 (1), Proactivos 4.0 (4), OESaber 1.0 (3). Las oficiales: **Mi Icfes 1.98 (41)** y la legacy **Icfes 1.99 (93), sin actualizar desde abril de 2020.**

❌ **Sin presencia digital verificable:** Sabero, Condoricfes, RedSaber/Redinncol, Instituto Mentor, "Hola Saber", "Esquema Educativo". No aparecen en Play (extraje 75 IDs de las búsquedas de `icfes`, `preicfes`, `saber 11`, `simulacro icfes`; ninguno coincide), ni en App Store CO. **Khan Academy no tiene contenido ICFES/Saber 11** — solo la citan sitios terciarios como refuerzo genérico.

**Lo que dice la estructura del mercado digital:**
1. **El líder tiene 1.3 estrellas.** La app oficial del ICFES, con 100 mil+ descargas, es el peor producto del mercado por calificación, en ambas tiendas.
2. **Nadie domina.** El techo es 100 mil+ y solo 3 apps lo alcanzan; dos de ellas son apps de un solo dev monetizadas con anuncios, no empresas. No hay un Duolingo del ICFES.
3. **Los nombres fuertes de la industria no están en móvil.** Milton Ochoa (1.800+ colegios), Seamos Genios y Helmer Pardo son 100% B2B institucional, sin app y sin precio público. **El canal B2C digital directo está abierto.**
4. **Dos modelos de precio separados por un hueco:** suscripción self-service barata ($19.900/mes, $50.000–$300.000 pago único) vs curso con clases en vivo ($450.000–$1.600.000). Nada en el medio.
5. **Oleada de apps con IA en 2026, todas sin tracción:** SabrIA, SaberLy, SaberCoach, Nandev, Lumina — publicadas sep-nov 2026, entre 1+ y 100+ descargas. Validan la tesis de producto; **nadie ha resuelto la distribución.**

---

## 3. CAPACIDAD DE PAGO

### 3.1 Salario mínimo

**2026 vigente: SMLMV $1.750.905 + auxilio de transporte $249.095 = exactamente $2.000.000.**
- [Decreto 1469 de 2025](https://apps.procuraduria.gov.co/normograma/compilacion/docs/decreto_1469_2025.htm) (29 dic 2025) — art. 1 escribe "$1.750.905"
- [Decreto 1470 de 2025](https://apps.procuraduria.gov.co/normograma/compilacion/docs/decreto_1470_2025.htm) — auxilio $249.095, para quienes ganan hasta 2 SMLMV
- Alza del 23% frente a 2025 ($1.423.500)

*Nota de litigio, relevante solo para la atribución, no para el monto:* el Consejo de Estado suspendió provisionalmente el Decreto 1469 el 12 feb 2026; el Gobierno expidió el Decreto 0159 de 2026 fijando transitoriamente **el mismo** valor; el 17 jul 2026 se revocó la suspensión. **El monto nunca cambió.**

⚠️ **Cuidado con un error de prensa frecuente:** varios medios llaman al mínimo 2026 "dos millones", confundiendo SMLMV con SMLMV+auxilio. Cualquier porcentaje de alza para 2027 calculado sobre $2.000.000 está mal; la base legal es $1.750.905.

**2027: NO decretado, NO acordado, sin cifra oficial.** La mesa se instala el **27 nov 2026**; 15 dic es el primer plazo legal (Ley 278/1996), 30 dic la fecha máxima del decreto. Propuestas que circulan, explícitamente no formales: CUT +38,5% → $2.422.000; analistas ~$1,9M. ([cronograma](https://www.portafolio.co/economia/salario-minimo-de-2027-gobierno-fija-fechas-y-pone-el-15-de-diciembre-como-primer-plazo-para-lograr-un-acuerdo-506592) · [propuestas](https://www.portafolio.co/economia/gobierno/salario-minimo-de-2027-estas-son-las-fechas-de-negociacion-y-las-propuestas-que-van-de-1-9-a-2-42-millones-506671))

**La aritmética que pediste:**

| Precio | % de 1 SMLMV ($1.750.905) |
|---|---|
| **$20.000/mes** | **1,14%** |
| **$50.000/mes** | **2,86%** |
| $20.000 × 12 meses | 13,7% de un salario mensual |
| $50.000 × 12 meses | 34,3% de un salario mensual |
| Curso presencial $797.000 | **45,5%** |
| Curso presencial $1.500.000 | **85,7%** |

Una suscripción de $20.000–$50.000/mes es 1,1%–2,9% de un salario mínimo mensual. **Sostenida 12 meses, sigue costando entre 2,5 y 8 veces menos que el curso presencial más barato.** El posicionamiento de precio es defendible.

### 3.2 Quién paga y cuánto pesa la educación en el presupuesto

**Gasto de los hogares en educación — tres mediciones que no se contradicen:**

| Medición | Educación | Año | Fuente |
|---|---|---|---|
| **ENPH** (gasto efectivo) | **3,0%** nacional / 3,2% cabeceras | 2016-17 | [PDF](https://www.dane.gov.co/files/investigaciones/boletines/enph/boletin-enph-2017.pdf) |
| **ECV módulo gastos** (el más reciente) | **3,2%** nacional / **3,6%** cabeceras / **0,6%** rural | 2021 | [PDF](https://www.dane.gov.co/files/investigaciones/condiciones_vida/calidad_vida/2021/presentacionECV_moduloGastos_2021.pdf) |
| **Ponderadores IPC** (canasta 2018, vigente) | **4,41%** | — | [DANE](https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos/indice-de-precios-al-consumidor-ipc/ipc-ponderadores) |

**Los dos matices decisivos, ambos publicados:**
1. **El 3% engaña.** En la ENPH el gasto promedio mensual en educación es **$238.000** contra un gasto total de **$1.792.000** — por *monto* es la 4ª categoría más alta de 12, aunque por *participación* esté casi al final. El gasto se concentra en la minoría de hogares que efectivamente paga.
2. **El peso escala brutalmente con el ingreso.** Ponderadores IPC por grupo: **Pobres 1,64 · Vulnerables 1,74 · Clase Media 4,29 · Ingresos Altos 6,55.** Y el gap urbano/rural del gasto efectivo es de casi **6x** (3,6% vs 0,6%). Tu comprador es clase media urbana; debajo de ahí la categoría casi no existe en el presupuesto.

**Distribución e ingreso (DANE, Pobreza Monetaria 2025, publicada jun-ago 2026):**
- **Clases sociales 2025:** Pobres **28,0%** · Vulnerables **30,7%** ($482.041–$943.791 per cápita) · **Clase media 38,0%** ($943.791–$5.081.953) · Alta 3,3%. **En cabeceras la clase media es 45,3%; en rural 13,3%.** [PDF](https://www.dane.gov.co/files/operaciones/PM/cp-PMClasesSociales-2025.pdf)
- **Ingreso per cápita promedio mensual 2025: $1.281.590** (cabeceras $1.492.582; rural $568.071). Bogotá $2.297.080 · Medellín $1.929.483 · Cali $1.584.398 · Barranquilla $1.390.697. **Es per cápita, no por hogar.** [PDF](https://www.dane.gov.co/files/operaciones/PM/pres-PM-2025.pdf)
- **Gini 2025: 0,531** (desde 0,551). Crecimiento real del ingreso per cápita 2024→2025: Q1 **+11,8%**, Q5 **+0,5%**. [PDF](https://www.dane.gov.co/files/operaciones/PM/bol-PM-2025.pdf)
- **18,9 millones de hogares, 53,3 millones de personas** (ECV 2025). [PDF](https://www.dane.gov.co/files/operaciones/ECV/bol-ECV-2025.pdf)

❌ **No publicado:** ingreso promedio o mediano **por hogar** para 2025 (DANE solo publica per cápita). Niveles de ingreso por quintil/decil en pesos para 2025. Los únicos deciles en pesos son de la ENPH 2016-17 (decil 1 $261.000 → decil 9 $3.560.000 → decil 10 $8.868.000).
❌ **No existe tabla oficial de DANE de hogares por estrato socioeconómico.** La ECV 2025 tiene cero menciones de "estrato". El estrato lo asigna cada municipio para tarifas de servicios públicos; no es una estadística que DANE produzca. Las cifras de prensa (Semana: estratos 1-3 ≈ 89,6% de predios urbanos; Portafolio: ~80% en 1-3) **no las pude verificar contra publicación primaria.**
❌ **No hay ENPH más reciente — confirmado.** DANE sigue mostrando 2016-2017 como la última; se hace "aproximadamente cada 10 años". Los titulares de "ciclo 22/23/24 de la ENPH" son ciclos de *campo* de la operación 2016-2017, no una ronda nueva. **ECV 2021 es el dato de gasto en educación más reciente que existe.**

### 3.3 Disposición a pagar — la señal más incómoda del informe

**No existe una encuesta publicada que mida disposición a pagar por educación complementaria digital en Colombia.** Lo que hay es tangencial y débil, y apunta en contra:

- **Bancolombia Día a Día** (cierre 2025): suscripciones de educación y noticias entre **$36.000 y $72.000/mes**; 5-8 suscripciones activas por usuario. ⚠️ **Muestra de solo 157 personas** — señal, no dato. [El Colombiano](https://www.elcolombiano.com/negocios/colombianos-gastan-hasta-900-mil-en-suscripciones-AD35360022)
- **CRC, estudio OTT 2025: el 91% de los hogares colombianos NO tiene suscripción paga de audio streaming**, y la CRC concluye que el precio sigue siendo el factor determinante.
- **MinEducación: +1,2 millones** de colombianos usaron formación virtual **gratuita** en 2025, +34% interanual. El comportamiento masivo revelado es consumo gratuito.
- **DANE:** la razón #1 por la que 4,944 millones de hogares no tienen internet es **"es muy costoso": 44,8%** (50,2% en cabeceras). El costo, no la cobertura, es la barrera dominante.

Dicho de frente: **no hay evidencia publicada de que las familias colombianas paguen suscripciones de educación; sí hay evidencia (CRC, MinEducación, DANE) de fuerte preferencia por lo gratuito.** El rango $36.000–$72.000/mes es el único ancla de precio digital educativo publicado, y su muestra es minúscula. Nota que **Saber911 ya cobra $19.900/mes**, por debajo de ese rango.

### 3.4 Smartphones, gama y sistema operativo

**Penetración — DANE, indicadores básicos de TIC, datos 2025, publicado 30 sep 2026.** [PDF](https://www.dane.gov.co/files/operaciones/TICH/bol-TICH-2025.pdf) (verificado en primaria)

| Indicador (2025) | Nacional | Cabecera | Rural |
|---|---|---|---|
| Personas 5+ que **tienen** celular | **80,1%** | 83,7% | 68,0% |
| De ellos, **es smartphone** | **94,6%** | 95,8% | 89,4% |
| Personas 5+ que **usan** celular | **91,9%** | 93,5% | 86,7% |
| Hogares con ≥1 celular | 97,4% | 98,8% | 92,7% |
| **Hogares con internet** | **73,9%** | 78,8% | 56,9% |
| **Hogares con computador** | **37,2%** | 44,6% | **11,0%** |

*Derivado (no publicado directamente): 80,1% × 94,6% ≈ **75,8% de personas 5+ tiene smartphone**.*

**Uso de internet por edad (2025) — el grupo que te importa:**

| Edad | 2024 | **2025** |
|---|---|---|
| Total | 79,4% | 82,3% |
| 5-11 | 62,3% | 64,5% |
| **12-24** | 91,3% | **93,8%** |
| 25-54 | 88,4% | 91,1% |
| 55+ | 58,7% | 63,2% |

**El grupo 12-24 es el de mayor uso de internet del país: 93,8%.** Y el de mayor uso de computador: 56,9%.

**Gama de teléfono — el dato que más importa para el diseño:**
🎯 **El 92% del mercado colombiano son teléfonos por debajo de USD 250** (Counterpoint Research, 1T 2026). Envíos +4% interanual; Xiaomi líder; 5G ~33% del mercado. https://counterpointresearch.com/en/reports/columbia-smartphone-shipments-grew-q1-2026

**Cuota por marca — Omdia, 2T 2026 (envíos reales):** Xiaomi **27%** · Samsung **22%** · Motorola **15%** · OPPO 11% · TRANSSION 10%. Top 5 = 85%. **Apple no aparece en el top 5.** [TelecomLead](https://telecomlead.com/smart-phone/colombia-smartphone-market-q2-2026-xiaomi-leads-samsung-as-claro-and-tigo-movistar-reshape-mobile-competition-127570)

**Android vs iOS — StatCounter, oct 2026: Android 73,68% / iOS 26,32%.** https://gs.statcounter.com/os-market-share/mobile/colombia
⚠️ **Advertencia metodológica que cambia la decisión:** StatCounter mide **páginas vistas, no dispositivos ni ventas**, y sobrerrepresenta sistemáticamente a iOS porque los usuarios de iPhone en LATAM navegan más y tienen mejores planes de datos. El contraste lo prueba: Apple está **fuera del top 5 de envíos** (Omdia) pero StatCounter le da 26% del tráfico, con 29% adicional de "desconocido". **El reparto real de dispositivos está mucho más cargado hacia Android que 74/26.** Esto se confirma del lado del producto: en App Store las apps de ICFES tienen de 1 a 9 reseñas; en Play tienen hasta 1.800. **Android-first es la decisión correcta y el iOS es prácticamente irrelevante para este segmento.**

❌ **No publicado:** **no existe precio promedio (ASP) del smartphone en Colombia** de ninguna fuente creíble. Busqué Counterpoint, IDC, Canalys, Omdia, Statista, Asomóvil y Fenalco. Lo que circula son precios de catálogo de modelos individuales, no promedios de mercado. Tampoco hay distribución oficial entrada/media/alta más allá del umbral de USD 250. Ni cuota de SO de fuente colombiana oficial o de Kantar/IDC (Kantar discontinuó sus paneles LATAM).
⚠️ **Conflicto entre casas de análisis que no pude resolver:** Counterpoint pone a Samsung primero en Colombia en 2T 2026; Omdia pone a Xiaomi con 27%. Miden canales distintos.

### 3.5 Prepago, datos móviles y WiFi — crítico para el peso de la app

**MinTIC, Boletín Trimestral TIC 2T 2026** (publicado 23 oct 2026): https://www.mintic.gov.co/portal/inicio/Sala-de-prensa/Noticias/442272:Colombia-alcanzo-49-6-millones-de-accesos-a-Internet-movil-y-10-78-millones-de-conexiones-fijas-en-el-segundo-trimestre-de-2026

| Indicador (jun 2026) | Valor |
|---|---|
| Líneas móviles totales | **87 millones** |
| **Prepago** | **62,9 M (72,3%)** |
| Pospago | 24,1 M (27,7%) |
| Accesos a internet móvil | 49,6 M (92 por 100 hab.) |
| Accesos 5G | 10,7 M; cobertura en 15,06% de municipios |
| **Consumo medio por acceso (suscripción)** | **19,9 GB/mes** |

*El porcentaje de prepago es cálculo mío sobre los absolutos; MinTIC publica los absolutos. La CRC sí publica el porcentaje como serie: prepago 80,0% (2016) → **75,9% (2025)**, en su [documento soporte de mayo 2026](https://www.crcom.gov.co/system/files/Proyectos%20Comentarios/2000-41-7-16/Propuestas/documento-soporte-analisis-condiciones-competencia-mercado-relevante-servicios-moviles-ok.pdf).*

🎯 **El desglose decisivo para el peso de la app** (consultora Nae, #BarómetroTelcoColombia, 2T 2026, datos MinTIC+CRC): **pospago 19,9 GB/mes vs prepago 8,2 GB/mes.** Brecha de 11,7 GB. https://mobiletime.la/noticias/06/11/2026/el-trafico-movil-en-colombia-crece/

**El usuario prepago consume menos de la mitad que el pospago. Y el prepago es ~72% de las líneas.** Para el peso de la app y el consumo de datos, esto es el dato que manda.

**El matiz más importante de esta sección, y reconcilia una aparente contradicción:** CRC, 3T 2025 — de 104,6 millones de líneas, **solo 45,5 M (43,5%) generaron ingresos**; **el 56,5% son prepago sin compra**, sin ingreso alguno. https://www.crcom.gov.co/es/noticias/comunicado-prensa/servicios-moviles-en-colombia-siguen-creciendo-ingresos-superan-34
Es decir: el "72% prepago" cuenta SIM inactivas. Sobre líneas *activas* (prepago con compra 18,9M vs pospago 19,8M), el pospago es ligeramente mayoritario. **No cites "72% prepago" y "53,6% prepago" (cifra de Nae, solo líneas de internet móvil) juntas sin explicar que son universos distintos** — se pierde credibilidad.

*Nota: el total de líneas cayó de 94,6M (1T) a 87M (2T 2026), −7,6M, concentrado en prepago. **No es cambio metodológico:** son depuraciones de bases de clientes de los operadores sobre líneas sin facturación ([El Colombiano](https://www.elcolombiano.com/negocios/colombia-pierde-76-millones-lineas-moviles-segundo-trimestre-2026-FE42315415)).*

**Dónde se conectan — DANE 2025 (mismo PDF):**

| Dispositivo | Nacional | Cabecera | Rural |
|---|---|---|---|
| **Celular** | **97,0%** | 96,8% | **97,8%** |
| Portátil | 27,4% | 31,1% | 12,4% |
| Escritorio | 21,5% | 24,1% | 11,2% |
| Tableta | 3,5% | 4,0% | 1,5% |

| Sitio de uso (no excluyentes) | Nacional | Rural |
|---|---|---|
| **El hogar** | **96,0%** | 92,2% |
| El trabajo | 36,4% | 22,8% |
| **En desplazamiento** | **22,8%** | 19,4% |
| Institución educativa | 16,6% | 15,6% |
| **CAP gratuito (WiFi público)** | **4,8%** | 4,9% |

**El celular es el acceso casi universal (97%), y más en rural (97,8%) que urbano.** El WiFi público es marginal (4,8%). Frecuencia: **80,3% usa internet todos los días** (84,6% cabecera, 62,9% rural). Actividad #1: **redes sociales, 82,7%**.

**El escenario real de tu usuario, compuesto de datos verificados:** Android de gama de entrada (92% bajo USD 250), prepago (72% de líneas) con ~8,2 GB/mes, conectado mayormente por WiFi doméstico (96% usa en el hogar), con datos móviles escasos y medidos cuando está fuera (22,8% usa en desplazamiento). **Diseña para offline-first y bajo peso.**

❌ **No publicado:** porcentaje de planes con límite de datos como agregado (los operadores ya lo reportan a la CRC por Resolución 8286 de 2026, pero no está publicado). Boletín TIC 3T 2026 (aún no sale). Cruce de sitio de uso por edad (solo vía microdatos).

---

## 4. COMPORTAMIENTO DIGITAL DE ESE GRUPO DE EDAD

### 4.1 La mejor fuente colombiana sobre adolescentes 10-18

**"Jóvenes en línea: Ciudadanía digital en niños, niñas y jóvenes de la generación Z en Colombia"** (2024) — Fundación CIVIX Colombia + UNIMINUTO, apoyo de la UE. ISBN 978-958-763-728-1. **n = 6.070 participantes, 110 colegios, 10-18 años.** Verificado extrayendo el PDF. [PDF completo](https://www.eeas.europa.eu/sites/default/files/documents/2024/Jo%CC%81venes%20en%20li%CC%81nea%20Ciudadani%CC%81a%20digital%20en%20nin%CC%83os%2C%20nin%CC%83as%20y%20jo%CC%81venes%20de%20la%20generacio%CC%81n%20Z%20en%20Colombia.pdf)

**10 horas diarias en línea en promedio** (suma de plataformas). Desglose:

| Plataforma | Horas/día |
|---|---|
| Streaming (YouTube, Netflix) | **2,4** |
| Redes sociales (Instagram, Facebook, X) | **2,2** |
| Mensajería (WhatsApp, Telegram) | **2,0** |
| Videojuegos (Roblox, Minecraft) | 1,8 |
| Buscadores | 1,7 |

🎯 **El hallazgo que más importa para tu producto: en grados 10.º y 11.º el streaming baja casi a 1 hora y sube el tiempo en mensajería, redes y búsqueda de información.** Tu público exacto cambia de consumo pasivo a comunicación y búsqueda. En grados bajos el streaming sube a 2 h.

**Multitarea — evidencia directa de atención dividida:** mientras navegan, los NNyA **estudian (17,6%)**, descansan (16,4%), juegan (16,4%), comen (15,3%).

**Estrato:** estratos 3-6 pasan más tiempo (2,6 h en redes/streaming/mensajería).

**Apps más usadas, adolescentes colombianos 10-18** (pregunta 18, N1=26.872 respuestas) — **este es el desagregado por edad que pediste, y es colombiano:**

| Plataforma | % |
|---|---|
| **WhatsApp** | **18,8%** |
| **TikTok** | **16,7%** |
| YouTube | 15,6% |
| Facebook | 14,2% |
| Instagram | 13,5% |
| Snapchat | 5,0% |
| Twitch | 4,0% |
| Discord | 3,6% |
| X | 3,5% |
| Telegram | 2,8% |

**WhatsApp es la #1 en todos los estratos.** Variación: rural/estrato 1 → más WhatsApp y Facebook; estratos 2-3 → WhatsApp y TikTok; estratos 4-6 → WhatsApp, YouTube y TikTok.

### 4.2 Otros datos colombianos

- **DANE 2025** (primaria): 82,3% de personas 5+ usó internet; **82,7% para redes sociales** (actividad #1); 80,3% lo usa todos los días. ❌ **El boletín DANE no publica horas diarias de uso ni desagrega redes sociales por edad.** Ese cruce no existe en la fuente oficial.
- **Colombia ~3h25/día en redes sociales** (población **16-64, no adolescentes**), dato de GWI vía DataReportal *Digital 2025*: Colombia **4.º de 54 mercados**, a 5 min de Brasil. ([Portafolio](https://www.portafolio.co/tendencias/cuanto-tiempo-pasan-los-colombianos-usando-las-redes-sociales-ranking-lo-revela-624776) · [La República](https://www.larepublica.co/internet-economy/colombia-es-el-cuarto-pais-que-consume-mas-tiempo-contenidos-en-redes-sociales-4080938))
  ⚠️ **Hallazgo metodológico: DataReportal RETIRÓ esta métrica.** Abrí `digital-2026-colombia` y `digital-2025-colombia`: **ninguna contiene el tiempo diario en redes**. La cifra es prensa citando GWI, **no cita primaria**. Dos medios independientes coinciden, pero márcala como secundaria.
- **"Contigo Conectados"** (Tigo + Universidad de los Andes + Aulas en Paz, 2024), n>5.700 en 19 departamentos. ⚠️ **Sin verificar en primaria** (no pude abrir contigoconectados.com). Vía prensa: ~3 h/día de ocio en línea; 29% de menores de 13 tiene cuenta en redes; **15% dice que sus calificaciones se vieron afectadas por el tiempo en internet**. ([Portafolio](https://www.portafolio.co/tecnologia/revelan-como-utilizan-internet-los-ninos-ninas-y-adolescentes-despues-de-la-pandemia-601287))
- **Población general Colombia** ([DataReportal Digital 2026](https://datareportal.com/reports/digital-2026-colombia), datos oct-dic 2025): 37,7 M de identidades en redes = 70,4% de la población. ⚠️ **Los porcentajes por plataforma de DataReportal son alcance publicitario, no usuarios activos** — la propia fuente advierte contra tratarlos como MAU. **No los uses como "% de usuarios".** ❌ No publica desagregado 16-24 en abierto.

❌ **No existe públicamente:** estudio **Kids Online Colombia / Global Kids Online** con horas de uso (sí existe para Uruguay y Chile). Estudio **"Me gusta en internet" de Red PaPaz** (ninguna búsqueda lo devolvió). Datos de **data.ai / Sensor Tower** de tiempo por app para Colombia (informes de pago).
⚠️ **Discrepancia a no mezclar:** una nota da TikTok Colombia en 32 h/mes (~1 h/día), lo que **contradice a la baja** las 2,2 h/día de redes del estudio CIVIX. No combines ambas cifras.

### 4.3 Proxy EE.UU. — el dato más riguroso que existe (NO colombiano)

**"The 2026 Common Sense Media Census: Tech and Media Use by Tweens and Teens"**, publicado **27 oct 2026**. n = **1.211**, 9-17 años, representativo nacional EE.UU. Verificado extrayendo el PDF. [Página](https://about.commonsensemedia.org/research/the-2026-common-sense-media-census-tech-and-media-use-by-tweens-and-teens) · [PDF](https://www.commonsensemedia.org/sites/default/files/research/report/commonsensemedia_techmediausetweensteens_report_2026.pdf)

- **Teens (13-17): 8 h 15 min/día** de pantalla para entretenimiento. Tweens (9-12): 5 h 00.  *(Mediana, no media.)*
- **43% de los teens pasan 10+ horas/día.** Solo 8% está bajo 3 h.
- Desglose teens: TV/videos 3h36 · videojuegos 2h00 · **redes sociales 2h00** · IA 1h00.
- **Video corto (TikTok/Reels/Shorts): teens 1h55**, y es la actividad diaria con mayor participación de todas: **82% de teens** lo hace a diario.
- **Lectura por placer: solo 23% de teens** leyó el día encuestado; quienes leen dedican ~1 h, **la mitad de lo que dedican a redes.**
- 🎯 **Dato de oro para el problema de retención:** *"heavy use doesn't always track with enjoyment"* — **la mayoría de teens usa redes sociales pero menos de la mitad las disfruta**; solo ~1 de cada 10 que usa IA dice disfrutarla "a lot". **El video corto es la única excepción donde el disfrute sigue el ritmo del tiempo invertido.**

⚠️ **Dos cambios metodológicos que hay que declarar al citarlo:** pasaron de media a mediana, y estrecharon el rango de 8-18 a 9-17. **El informe NO compara tiempo total con oleadas anteriores** — decir "subió respecto a 2021" sería incorrecto. La multitarea se cuenta aparte, así que los totales no son horas literales del día.

### 4.4 Procrastinación académica y redes — estudios, no opiniones

**EL META-ANÁLISIS (verificado línea por línea en el PDF):**
**Hidalgo-Fuentes, S. (2022). "Uso problemático de Internet y procrastinación en estudiantes: un meta-análisis."** *European Journal of Education and Psychology*, 15(1), 1-18. **DOI: 10.32457/ejep.v15i1.1815**. Universidad de Valencia. [PDF](https://dialnet.unirioja.es/descarga/articulo/8464530.pdf)

- **17 tamaños del efecto independientes, 16 artículos, N = 8.421 estudiantes.** PsycInfo, Scopus, PubMed, WoS.
- 🎯 **r = .40; IC 95% [.32, .47]**, p < .001. Efecto **moderado** (Cohen 1988). Efectos aleatorios.
- Heterogeneidad alta: I² = 93,94%.
- **Robusto:** test de Egger p = .98 (sin sesgo de publicación); N de seguridad de Rosenthal = 8.944 estudios nulos necesarios para invalidar, contra un umbral de 95.
- **Moderadores todos NO significativos:** sexo (p=.58), edad media (p=.71), **secundaria vs universidad (p=.36)**. **La relación se sostiene igual en secundaria que en universidad** — aplica directo a tu público.
- ⚠️ **Dos precisiones:** mide **uso problemático de Internet**, no redes sociales en sentido estricto; y aunque autor español y revista chilena/española, los estudios incluidos son internacionales, **no específicamente latinoamericanos**.
- ❌ **No existe meta-análisis específico de "redes sociales × procrastinación académica".** Este es el más cercano que hay publicado.

**Estudios individuales:**
- **Pakistán 2025**, estudiantes de medicina: **r = 0,539** entre adicción a redes y procrastinación. [PMC11911750](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11911750/) ⚠️ cifra vía búsqueda, no abrí el full text.
- **Hispanohablante, jun 2025**, n=145: **ρ = 0,61, p < 0,001**. [DOAJ](https://doaj.org/article/6b1002546fd44ee48a747d8ed6274f9b) ⚠️ sin verificar en primaria.
- 🎯 **HALLAZGO NULO, importante por honestidad intelectual:** *Revista Eugenio Espejo* (2022), universitarios de la selva peruana: **NO halló correlación global** entre adicción a redes y procrastinación (p > 0,05). Sí con subdimensiones (autorregulación, postergación). [Redalyc](https://www.redalyc.org/journal/5728/572872037002/572872037002.pdf) **Vale citarlo: la relación no es universal y depende del instrumento (adicción vs. uso).**
- **Contrapeso útil:** meta-análisis 2025 sobre adicción al smartphone/redes/videojuegos → **d = −0,085** sobre *rendimiento académico*. Significativo pero **muy pequeño**. ⚠️ sin verificar. El efecto sobre *notas* es mucho menor que la correlación con *procrastinación*.

❌ No encontré estudios de "phubbing × procrastinación" con datos cuantitativos verificables.

---

## 5. QUÉ FUNCIONA (Y QUÉ NO) EN APPS EDUCATIVAS PARA ADOLESCENTES

### 5.1 Duolingo — lo que sí publicó

🎯 **El dato de rachas, fuente primaria de Duolingo** — [blog.duolingo.com/improving-the-streak](https://blog.duolingo.com/improving-the-streak), Anton Yu, 19 nov 2020:
- **"Los estudiantes que alcanzan una racha de 7 días son 2,4 veces más propensos a seguir usando Duolingo al día siguiente"** que los que no tienen racha.
- A/B test (separar la meta diaria de la racha): **+3,3% retención D14**, +1% DAU total, +10,5% de learners diarios con racha en 20 días, **+40% en learners con racha de 7+ días**.
- 🎯 **Casi 40% de los learners activos dos días seguidos sin racha tenían la meta diaria "intense"** — la meta demasiado agresiva impedía que se formara la racha. **Hallazgo de diseño directo: una meta ambiciosa destruye la racha.**
- ⚠️ Son **cambios relativos, no puntos porcentuales**. Es **disclosure corporativo, no revisado por pares**. Y es de **2020** — el dato más reciente que Duolingo publicó sobre rachas.

**Notificaciones push — paper revisado por pares:** Yancey, K. P. & Settles, B., **"A Sleeping, Recovering Bandit Algorithm for Optimizing Recurring Notifications"**, KDD 2020. [PDF oficial](https://research.duolingo.com/papers/yancey.kdd20.pdf)
- Algoritmo *Recovering Difference Softmax* sobre **millones de recordatorios diarios**.
- 🎯 **+0,5% en DAU totales y +2% en retención de usuarios nuevos** sobre un baseline ya fuerte.
- 🎯 **Relevante para el diseño:** el paper existe porque los bandits convencionales fallan ante **"novelty effects"** y elegibilidad condicional. **Duolingo documenta que el contenido de notificación se desgasta con la repetición** — evidencia directa de fatiga de mecánica. Dataset público: 200 M de notificaciones en 35 días.

**Métricas recientes:**
- **Q3 2026** (3 nov 2026): **DAU 64,9 M, +29% YoY** (acelerando desde +23%). [comunicado](https://finviz.com/news/414652/duolingo-reports-third-quarter-2026-results)
- **Q2 2026: DAU 58,7 M; CURR (Current User Retention Rate) = 84%**, ~+1 punto YoY, **máximo histórico**. CURR = proporción de usuarios diarios que vuelven al día siguiente. [Customer Experience Dive](https://www.customerexperiencedive.com/news/duolingos-user-retention-hits-all-time-high-as-app-boosts-stickiness/827499/)
- **Streak Revival** (jun 2026): campaña única para recuperar rachas perdidas con 3 lecciones → **15,4 M de learners revivieron su racha, casi 8 M de ellos sin racha activa**.
- ❌ **Duolingo NO publica el ratio DAU/MAU.** El CEO dijo que "sube casi todos los trimestres", sin cifra. **Las estimaciones de ~37-41% que circulan son cálculos de terceros sobre MAU no confirmado — no las uses como dato publicado.**
- ❌ **No existe paper de Duolingo sobre "streak freeze".**
- ⚠️ investors.duolingo.com y duolingo.gcs-web.com devuelven **403** a acceso automatizado; CURR y DAU vienen de prensa financiera citando la carta.

### 5.2 Benchmarks de retención en educación — **las fuentes se contradicen 4x**

| Fuente | D1 | D7 | D30 |
|---|---|---|---|
| [Business of Apps](https://www.businessofapps.com/data/education-app-market/) | — | — | **~2%** ("de las más bajas de todos los sectores") |
| [Phiture](https://phiture.com/mobilegrowthstack/managing-retention-rate-benchmarks-and-expectations/) | ~14-15% | ~6% | 2-3% |
| [Getstream/OneSignal](https://getstream.io/blog/app-retention-guide) | **27,5%** | **17,76%** | **8,02%** |
| Cross-industry (Phiture, 2025-26) | 25-26% | 11-13% | 5-7% |

**Interpretación honesta: lo único en que todas coinciden es que D30 en educación es bajo y está entre los peores de todas las categorías. El rango D1/D7 no es verificable públicamente sin pagar el informe.** La discrepancia viene de cómo define cada quien "retención" y qué cohortes mide. ⚠️ Business of Apps devuelve 403 a fetch; cifra vía búsqueda, sin verificar en primaria.
**AppsFlyer 2025** no publica la tabla de educación en abierto. Lo que sí dice: en Android, **Educación tuvo +29% de crecimiento YoY en retención**, entre las categorías que más crecieron. [metodología](https://www.appsflyer.com/benchmarks/faq/)
*Dato de monetización del mismo informe de BoA: conversión store→descarga 34,4% Play / 18,1% iOS; ~50% de suscriptores renueva tras la primera renovación; precio medio USD 8,13/mes.*

### 5.3 Por qué un adolescente abandona una app — la evidencia

🎯 **(1) Deserción real medida en adolescentes con logs, no autorreporte — la cifra más dura que existe**
**Maenhout, L., Peuters, C., et al. (2022).** *JMIR mHealth and uHealth*, 10(5), e36404. **DOI: 10.2196/36404**. [Artículo](https://mhealth.jmir.org/2022/5/e36404) · [PubMed 35536640](https://pubmed.ncbi.nlm.nih.gov/35536640)
- **n = 186 adolescentes de 12-15 años**, programa de 12 semanas, medido con **logs reales de uso**.
- **30,1% (56/186) abrió la app SOLO el día de instalación.**
- **44,1% (82/186) dejó de usarla en la PRIMERA SEMANA.**
- **95,7% (178/186) la había abandonado a las 12 semanas.**
- 🎯 **Predictores:** más tiempo en los componentes de **autorregulación** y **narrativa** durante la primera semana → **menor deserción**. El **chatbot NO tuvo relación con la retención.** El nivel socioeconómico no moderó.
- ⚠️ Es app de salud, no educativa. Úsalo como proxy de "adolescente + app de hábito diario", declarándolo.
- **Implicación: la ventana crítica es la semana 1, y lo que retiene es autorregulación y narrativa, no lo conversacional.** Nota el contraste con la oleada de apps-con-IA-chatbot de 2026 (§2.4), todas sin tracción.

🎯 **(2) El clásico sobre recompensas extrínsecas — verificado en el PDF**
**Deci, E. L., Koestner, R., & Ryan, R. M. (1999).** "A Meta-Analytic Review of Experiments Examining the Effects of Extrinsic Rewards on Intrinsic Motivation." *Psychological Bulletin*, **125(6), 627-668**. [PDF](https://depts.washington.edu/techdocs/papers/deciExtrinsicRewardsAndIntrinsicMotivation99.pdf) · [PubMed 10589297](https://pubmed.ncbi.nlm.nih.gov/10589297/)
- **128 estudios experimentales.** Recompensas contingentes al **compromiso d = −0,40**; a la **finalización d = −0,36**; al **desempeño d = −0,28** — todas **socavan** la motivación intrínseca de libre elección.
- 🎯 **Feedback positivo MEJORA:** libre elección **d = +0,33**, interés autorreportado **d = +0,31**.
- 🎯 **El hallazgo más relevante para una app de adolescentes:** *"Tangible rewards tended to be more detrimental for children than college students"* — **las recompensas tangibles son MÁS dañinas en niños/adolescentes que en universitarios.**
- **Lectura de diseño, y es incómoda para el modelo de rachas:** una racha o premio **contingente a completar la tarea** (d = −0,36) es exactamente la contingencia que más daño hace. **El feedback positivo informativo (+0,33) es la alternativa con evidencia a favor.**

**(3) Gamificación educativa: efecto grande, con advertencias serias**
**Li, M., Ma, S., & Shi, Y. (2023).** *Frontiers in Psychology*, 14. **DOI: 10.3389/fpsyg.2023.1253549**. [Artículo](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2023.1253549/full)
- **41 estudios, 49 muestras, >5.071 participantes. Hedges g = 0,822; IC 95% [0,567, 1,078]** — efecto grande. I² ≈ 94%.
- 🎯 **Por nivel educativo el efecto se desploma con la edad:** primaria **g = 1,293** (k=12) · secundaria g = 0,869 (k=29) · **superior g = 0,014** (k=8, nulo). ⚠️ El artículo es internamente inconsistente aquí (el texto invierte secundaria y superior respecto a la Tabla 2); bajo cualquiera de las dos lecturas, **primaria > resto y el efecto cae con la edad**. Tu público (16-18) está en el extremo alto de secundaria, cerca de donde el efecto se desvanece.
- 🎯 **El hallazgo que más debería preocupar:** **aprendizaje en línea g = 0,340 con IC [−0,131, 0,812] — incluye el cero, o sea NO significativo en entornos online**, que es precisamente el caso de una app. El efecto grande se da sobre todo en aula.
- **Por duración:** los tramos donde vive una app real (1 semana–3 meses) son los más flojos: **g ≈ 0,48-0,62**. ⚠️ Los tramos con k=1 o k=5 (incluido g=3,304 en ">1 semestre" con k=5) **no son citables**.

**(4) Cuando la gamificación perjudica el aprendizaje — peer-reviewed, sobre Duolingo específicamente**
**Hadi Mogavi, R., Guo, B., Zhang, Y., Haq, E.-U., Hui, P., & Ma, X. (2022).** "When Gamification Spoils Your Learning: A Qualitative Case Study of Gamification Misuse in a Language-Learning App." **ACM Learning @ Scale (L@S '22)**. DOI: **10.1145/3491140.3528274** · [arXiv:2203.16175](https://www.arxiv.org/abs/2203.16175)
- **9 años de foros de Duolingo + 15 entrevistas semiestructuradas.**
- Define **"gamification misuse"**: el usuario **se fija en los elementos de juego y pierde el foco en el aprendizaje**.
- **El mal uso daña el aprendizaje, el bienestar y la ética** del usuario. **Causas: competitividad, exceso de indulgencia lúdica (overindulgence in playfulness) y comportamiento de manada (herding).**
- Es la **mejor evidencia revisada por pares sobre el lado oscuro de la gamificación** en esta app concreta. ⚠️ Leí abstract y metadatos, no el full text; el abstract no detalla hallazgos sobre rachas en particular.

**(5) "Streak anxiety": ❌ NO EXISTE como literatura revisada por pares.** Lo busqué expresamente. Lo que hay:
- [Universidad de Essex](https://repository.essex.ac.uk/41011/1/Jabbari%2C%20Zarrinabadi%2C%20%26%20Amini%20%28accepted%20copy%29.pdf) (Jabbari, Zarrinabadi & Amini), n=191 usuarios de Duolingo: señala que **funciones competitivas como los leaderboards pueden causar ansiedad** en algunos aprendices. Las rachas no son el foco.
- Un estudio en repositorio universitario: la racha fue percibida como la función **más efectiva** para retener vocabulario, pero **"ocasionalmente creaba presión o ansiedad"**. ⚠️ Estatus de peer-review no confirmado — **no lo cites como revisado por pares.**
- The Decision Lab ("Streak Creep") cita un paper del *Journal of Consumer Research* según el cual los usuarios llegan a **valorar extender la racha por encima de la actividad subyacente** y **se desmotivan cuando saben que pueden repararla** (relevante para "streak freeze"). ⚠️ **No pude localizar el paper original ni confirmar autores — NO verificado, es blog citando un paper sin referencia completa.**

---

## LO QUE NO ESTÁ PUBLICADO — lista explícita

Para que la ausencia de dato no se confunda con falta de búsqueda:

**Calendario y tamaño**
1. **Calendario Saber 11 2027: el ICFES no lo ha publicado** (verificado hoy en la página oficial). Toda fecha de 2027 que circula es proyección de terceros.
2. Cifra oficial definitiva de evaluados Saber 11 2026. No hay boletín.
3. Total calendario A+B en una sola cifra. La serie del ICFES es solo A.
4. **No existe Informe Nacional de Resultados Saber 11 de 2025**; el último completo es 2024.
5. No hay boletín de matrícula del MEN que cubra 2025, ni DANE EDUC 2025. Para 2025, el dataset de datos.gov.co es la única fuente publicada.

**Competencia y precios**
6. Precios de **Milton Ochoa, Helmer Pardo, Instituto Mentor, Preicfes Quasar, Seamos Genios** — ninguno publica. Todos B2B institucional.
7. Ninguna academia presencial en **Barranquilla** con precio publicado.
8. **Horas totales de curso**: ninguna de las 6 academias las publica. Imposible calcular precio/hora sin inferir.
9. Precio de **Filadd** en fuente propia (su web es SPA; terceros se contradicen y una fuente es publicidad pagada).
10. **Apple no publica descargas** para ninguna app (límite de la plataforma).

**Capacidad de pago**
11. **No existe tabla oficial de DANE de hogares por estrato socioeconómico.** El estrato lo asigna cada municipio para tarifas de servicios públicos.
12. Ingreso promedio o mediano **por hogar** para 2025. DANE solo publica per cápita.
13. Quintiles/deciles en pesos para 2025. Los únicos son de la ENPH 2016-17.
14. **No hay ENPH más reciente que 2016-2017** (confirmado en DANE). La ECV 2025 no tiene módulo de gastos ni de estrato. **ECV 2021 es el dato de gasto en educación más reciente que existe.**
15. **Encuesta de disposición a pagar por educación complementaria digital en Colombia: no existe publicada.**

**Dispositivos y conectividad**
16. **Precio promedio (ASP) del smartphone en Colombia: ninguna casa de análisis lo publica.** Ni distribución oficial entrada/media/alta más allá del umbral de USD 250.
17. Cuota de SO móvil de fuente colombiana oficial o de Kantar/IDC. Solo StatCounter, con sesgo pro-iOS.
18. Porcentaje de planes con límite de datos como agregado.
19. Boletín TIC 3T 2026 (aún no publicado).
20. Cruce de sitio de uso de internet por edad (solo vía microdatos).

**Comportamiento y retención**
21. Tiempo diario en redes en las páginas de DataReportal Colombia 2025/2026 — **la métrica fue retirada**.
22. Estudio **Kids Online Colombia / Global Kids Online** con horas. Estudio **"Me gusta en internet" de Red PaPaz** — no indexado.
23. Horas diarias ni redes-por-edad en el boletín DANE.
24. Desagregado 16-24 de DataReportal Colombia.
25. Datos de data.ai / Sensor Tower de tiempo por app para Colombia.
26. **Meta-análisis específico de redes sociales × procrastinación académica.**
27. **Ratio DAU/MAU de Duolingo.** Paper de Duolingo sobre **streak freeze**. Literatura peer-reviewed sobre **streak anxiety**. Tablas D1/D7 de educación de AppsFlyer en abierto.

**Discrepancias sin resolver, a no mezclar:** benchmarks D30 de educación 2% vs 8% según la fuente · Counterpoint pone a Samsung primero en Colombia, Omdia a Xiaomi · evaluados Saber 11 2024 (498.583 vs 494.458, ambos del ICFES) · "72% prepago" (líneas totales) vs "53,6% prepago" (solo internet móvil) · TikTok Colombia 32 h/mes (~1 h/día) contra 2,2 h/día de redes del estudio CIVIX.

---

## SEIS CONCLUSIONES QUE SALEN DE LOS DATOS

1. **El mercado no crece por volumen, y el segmento de pago es angosto.** Evaluados planos en 457-507k desde 2016. El mercado direccionable de pago más obvio — **no oficial urbano — son 106.362 estudiantes de grado 11**, un 20,4% del total. Si el modelo necesita el otro 80%, necesita un precio que ese 80% pueda pagar.

2. **El incumbente es terrible y eso es la oportunidad.** La app oficial del ICFES tiene **1.3 estrellas con 100 mil+ descargas**; la legacy sigue publicada sin actualizar desde abril de 2020. Y los nombres fuertes de la industria (Milton Ochoa con 1.800+ colegios, Seamos Genios, Helmer Pardo) **no tienen app ni publican precios: son 100% B2B institucional. El canal B2C digital directo está libre.**

3. **El precio de $20.000-50.000/mes es defendible contra el presencial, pero no contra el gratis.** Es 1,1%-2,9% de un SMLMV y, sostenido 12 meses, cuesta 2,5 a 8 veces menos que el curso presencial más barato ($797.000). **Pero:** 91% de hogares sin suscripción de audio paga (CRC), 1,2 millones migrando a formación virtual gratuita (MinEducación), 44,8% de hogares sin internet por costo (DANE), **Saber911 ya cobra $19.900/mes**, y el mercado está lleno de apps gratis con anuncios que tienen 100 mil+ descargas. **No hay evidencia publicada de que estas familias paguen suscripciones educativas.** El modelo de precio es el riesgo mayor, no el producto.

4. **Diseña para Android de gama de entrada, prepago y offline.** 92% de los teléfonos bajo USD 250; ~72% de líneas prepago consumiendo **8,2 GB/mes** (menos de la mitad del pospago); 97% se conecta por celular; 96% usa internet en el hogar pero 22,8% también en desplazamiento; WiFi público marginal (4,8%). **iOS es irrelevante para este segmento** (1-9 reseñas por app en App Store contra hasta 1.800 en Play).

5. **La ventana crítica es la primera semana, y lo que retiene no es el chatbot.** 44,1% de adolescentes abandona una app de hábito diario en la semana 1; 95,7% a las 12 semanas (Maenhout 2022, con logs reales). **Los predictores de permanencia fueron autorregulación y narrativa; el chatbot no tuvo relación con la retención.** Eso debería leerse contra la oleada de apps-con-IA de sep-nov 2026, todas entre 1+ y 100+ descargas.

6. **La gamificación tiene menos respaldo del que se le supone, justo en este caso.** Las rachas funcionan en Duolingo (2,4x retención al día siguiente a los 7 días) y la meta demasiado agresiva las destruye (40% de los que no formaban racha tenían meta "intense"). Pero el meta-análisis de gamificación educativa da **g = 0,340 con IC que incluye el cero en entornos online** — no significativo —, el efecto **se desploma con la edad** (primaria 1,29 → superior 0,01), y Deci/Koestner/Ryan documentan que las recompensas contingentes a completar la tarea **socavan la motivación intrínseca (d = −0,36) y son más dañinas en adolescentes que en universitarios**, mientras el **feedback positivo informativo la mejora (+0,33)**. Hay además un paper peer-reviewed sobre **"gamification misuse" en Duolingo**: competitividad y herding que desplazan el foco del aprendizaje. **Copiar la mecánica de Duolingo sin más no está respaldado por la evidencia para este público y este medio.**

---

**Archivos descargados** (en el scratchpad de sesión; se borran con la limpieza rutinaria — si algo vale conservarse, hay que moverlo a un sitio durable). Base: `/private/tmp/claude-501/-Users-diegoandresramirezmejia-Dev-Cv/3dfb5e0e-4e53-4be4-860d-e63ac68c5026/scratchpad/`
- `co/jovenes_en_linea.pdf` — estudio CIVIX/UNIMINUTO, n=6.070 (68 pp.)
- `cs/census.pdf` — Common Sense Census 2026 (83 pp.)
- `meta/pui.pdf` — meta-análisis Hidalgo-Fuentes (18 pp.)
- `deci/deci99.pdf` — Deci, Koestner & Ryan 1999 (48 pp.)
- `duo/yancey.pdf` — paper KDD 2020 de Duolingo (9 pp.)
- `dane/tich2025.pdf` y `dane/tich2025.txt` — boletín DANE TIC 2025 (46 pp.)
- `edu/`, `dane_x/`, `enph/`, `icfesres/` — PDFs y XLSX de DANE/MEN/ICFES
- fichas `pg_*.html` de Play Store y `web_*.html` de plataformas, más
  los extractores que se usaron para leerlas

**Nota:** esos archivos vivían en el scratchpad de la sesión y ya se
borraron; no están en este repo y las rutas de arriba no existen aquí.
Lo que vale es lo escrito en este documento, con sus URLs. Para
repetir la investigación hay que volver a las fuentes.