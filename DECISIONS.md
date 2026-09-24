# Decision log

Append-only. Newest entries at the bottom. Every deviation from
`QUESTIONNAIRE-APP-BLUEPRINT.md` and every dependency beyond its §3 stack is recorded here with a
reason.

---

## 2026-09-22 — Dependencies beyond the blueprint §3 stack

None so far that need justifying. The installed set is exactly what §3 names: React 19, Vite 7,
TypeScript, Vitest + jsdom + @testing-library, oxlint, `@supabase/supabase-js`, and
`@fontsource/*` for self-hosted fonts.

`@testing-library/user-event` and `@testing-library/dom` are peers of
`@testing-library/react` and are not separate choices.

## 2026-09-22 — Fonts: Source Serif 4 + Source Sans 3

Blueprint §3 mandates self-hosted fonts via `@fontsource/*` but names none. Chosen: **Source
Serif 4** for the wordmark and screen titles, **Source Sans 3** for UI text. Both are open
licence, have real Spanish diacritic coverage, and are explicitly not the forbidden default
Inter/Roboto pairing (rule 7). The serif gives the survey a food-provenance register rather than a
SaaS-dashboard one.

## 2026-09-22 — Respondent-facing language: Spanish

Both source documents are in Spanish and the audiences are Spanish producers and consumers. No
i18n layer is built; strings live in `src/data/strings.ts` and in the questionnaire files.

## 2026-09-22 — Identification screen collects consent only

Both source documents state responses are treated "de forma anónima y agregada (RGPD)". Collecting
company names or demographics on a separate identification screen would contradict that promise and
duplicate questions the sources already number (consumer Block A, company Block 0). The
identification step therefore renders the privacy notice and the required consent checkbox, with
`IDENTIFICATION` holding an empty field list for both audiences. The field mechanism described in
blueprint §5.2 is implemented in full and stays available if the study owner later wants a field.

Confirmed with the project owner, 2026-09-22.

## 2026-09-22 — DEVIATION 1: new `scale_grid` question type

**Blueprint §6.3 lists six question types and mandates one question per screen.**

Consumer Block C is a single instruction — "Al comprar un jamón curado, ¿qué importancia da a cada
aspecto?" — followed by **13** items rated 1–5. Company Block 5 is the same shape with 5 items.
Modelling each item as its own `scale` question would produce 13 consecutive, visually identical
screens in a survey that is answered on a phone at a trade-fair stand. That is a real completion
risk, and it also misreads the source: the 13 items are one question, not thirteen.

`scale_grid` renders the instruction once and its rows as a rating matrix on one screen. It is a
first-class type, not a special case: `visibleQuestions`, `buildSnapshot`, `validateSubmission` and
both CSV export shapes handle it like any other. Each row keeps its own stored value, so the
exported analysis shape is identical to what 13 separate scale questions would have produced.

Cost: one variant in `types.ts`, one `AnswerValue` kind (`scaleRows`), one component
(`ScaleGrid.tsx`), one case in `QuestionScreen.tsx`.

Confirmed with the project owner, 2026-09-22.

## 2026-09-22 — DEVIATION 2: `display` flag on `SingleChoiceQuestion`

Consumer Q3 asks for the respondent's comunidad autónoma — 19 options. Rendered as radio cards like
every other single-choice question it would fill several screens of scrolling. The optional
`display?: 'radio' | 'select'` flag lets that one question use the `Select` component that
blueprint §4 already requires for identification fields.

This is presentation only. The answer is stored, validated, snapshotted and exported exactly as any
other `single_choice`. Default remains `'radio'`.

Confirmed with the project owner, 2026-09-22.

## 2026-09-22 — Consumer early exit is modelled as a conditional, not a new step

Consumer Q6 marks "Nunca" with "(fin del cuestionario)". Rather than add an early-exit step type to
`steps.ts`, every question after Q6 carries
`showIf: { questionId: 'I-Q06', optionIds: ['varias-semana', 'semanal', 'mensual', 'especiales'] }`.
A respondent who answers "Nunca" sees the flow shrink to its remaining step and lands on the
thank-you screen. This stays entirely inside the §5 data contract and needs no code.

Confirmed with the project owner, 2026-09-22.

## 2026-09-22 — Logo is a placeholder

> **RESUELTA** el 2026-09-23: el Consejo Regulador facilitó las marcas reales y el sello inventado
> se ha eliminado de la aplicación. Ver «Las marcas reales llegan a la portada», más abajo.

No official D.O. Jamón de Teruel asset was supplied. `public/logo-placeholder.svg` is a plain
typographic wordmark — no invented emblem, seal or crest (rule 6). `src/components/Logo.tsx` reads
a single `LOGO_SRC` constant so swapping in the official mark is a one-line change.

## 2026-09-22 — Dependency: `qrcode-generator` for the optional QR poster

Blueprint §4 lists `src/screens/QrScreen.tsx` as an optional printable QR poster pointing at the
public URL. Rendering a QR code needs Reed–Solomon error correction and the QR module layout
algorithm; hand-rolling that is far more code and risk than the dependency.

Chosen `qrcode-generator` (MIT, **zero runtime dependencies**, ships its own TypeScript types,
~15 kB) over `qrcode`, which pulls in a CLI and a `yargs` tree. It runs entirely in the browser at
render time: no image service, no remote request, nothing added to the network surface
(CLAUDE.md rule 3). The poster is drawn as one inline SVG path in the wine token colour.

---

## 2026-09-22 — Red is the primary colour, cream the secondary one

The first build used cream as the page background with red as an accent. Seen running, that reads
as a cream app with red trim, which is not the identity the project owner wants.

Same hues — `#7B2140` and `#4A1526` are unchanged. What changed is how much surface red occupies:
every screen now has a solid red **panel** carrying the wordmark, the progress and the question,
and a cream area carrying the answer. In the horizontal layout the panel is a full-height left
column; stacked, it is a block across the top.

The mechanism is worth knowing before editing anything: `.screen__panel` **redefines the semantic
colour tokens inside itself** (`--color-heading`, `--color-text`, `--color-text-muted`,
`--color-accent`, `--color-focus`, and the ProgressBar track). `Logo`, `ProgressBar` and the
headings read only those aliases, so they invert with no component change. That is the whole reason
`tokens.css` separates the raw scale from the semantic aliases — do not reintroduce raw
`--color-wine-*` references in components.

Measured contrast on the panel: cream-50 text **9.3:1**, wine-100 muted text **7.5:1**, focus ring
**9.3:1**. All AAA.

## 2026-09-22 — Companies give their name; consumers stay anonymous

**This supersedes the 2026-09-22 entry "Identification screen collects consent only" for the
company audience.** That entry stands unchanged for consumers.

The company survey is a census of roughly 200 named firms. Without the name the responses cannot be
de-duplicated, chased, or cross-checked against the sector register, which is most of the point of
a census. `IDENTIFICATION.company` therefore carries one required `short_text` field,
`companyName`, capped at 200 characters.

That changes what the app may promise, so the privacy notice is now per-audience:
`privacyNoticeIndividual` keeps the original "de forma anónima" wording; `privacyNoticeCompany`
promises **confidential treatment and aggregate publication**, states that the name is recorded to
de-duplicate the census, and notes that no personal data of the respondent is collected. The word
"anónima" does not appear on the company screen.

No new code was needed beyond the field and the notice: the identification mechanism, the
server-side validation of required fields, the `id_companyName` CSV column, the admin list summary
and the `ilike` search over `identification::text` were all built in the first pass and simply
started working.

## 2026-09-22 — DEVIATION 3: horizontal layout and a view toggle

> **SUPERADA** por «La pregunta pasa a ir encima de las respuestas», más abajo. Ya no hay
> dos composiciones ni botón de vista. Se conserva la entrada porque explica por qué se
> intentó el diseño a dos columnas y qué problema tenía.

**Blueprint §2 assumes a single stacked layout ("usable on a phone at a trade-fair stand").** The
app turns out to be used mostly on a laptop, where a 34 rem column on a 1440 px screen wastes most
of the display.

`Screen` now renders two layouts from the same props:

- **horizontal** — a two-column grid filling the viewport: red question panel | scrolling cream
  answer column. Only the answer column scrolls, so the 13-row rating grid never pushes the
  question off screen. Still **one question per screen** — the blueprint's actual rule is intact.
- **vertical** — the original stacked layout, with the sticky action footer.

Both live in `Screen.tsx` and `Screen.css` alone; no screen component knows which is active.
`forceStacked` opts the admin panel and the style guide out, since a wide table gains nothing from
a question/answer split.

## 2026-09-22 — Propuesta visual (design/propuesta-visual.html)

Encargo del responsable del proyecto: aspecto más profesional, institucional y premium, sin tocar
ni una pregunta, ni un texto, ni una opción. Se entrega como **un único archivo HTML
autocontenido** — una propuesta para validar antes de llevarla a la aplicación React. No modifica
todavía `src/`.

Paleta fija por el encargo: `#7B2140` `#641933` `#A33553` `#C39A4B` `#FCF8F0` `#F5EDDD` `#FFFFFF`
`#3A2A2E` `#E7DFD2`.

**Dos restricciones salieron de medir el contraste, no de la opinión:**

- **El vino `#A33553` sobre el panel granate da 1,5:1** — invisible. El encargo lo asignaba a la
  barra de progreso, pero sobre granate no se ve. La barra usa oro `#C39A4B` (3,77:1, suficiente
  para objeto gráfico) y el vino se queda donde sí contrasta: selección y hover sobre crema
  (6,21:1).
- **El oro sobre crema da 2,46:1** — nunca se usa para texto ni para bordes con significado sobre
  el área clara: solo filete decorativo y sello.

Resto de medidas: crema sobre granate 9,29:1 · `#E8D5C8` sobre granate 6,93:1 · texto sobre crema
12,79:1 · vino sobre crema 6,21:1.

**Tipografía: Spectral + Source Sans 3.** El encargo proponía «Fraunces o Spectral» y «Inter».
Se eligió Spectral: Fraunces está señalada como fuente sobreexpuesta por el detector de diseño, y
Spectral tiene un registro más institucional para un Consejo Regulador. Inter se sustituye por
Source Sans 3, que ya estaba en el proyecto y evita el emparejamiento por defecto que prohíbe la
regla 7 de CLAUDE.md. Ambas van **incrustadas en base64**: el archivo no hace ninguna petición de
red (163 KB, offline).

**El sello es un marcador de posición, no la marca oficial.** La regla 6 de CLAUDE.md prohíbe
inventar logotipos; el responsable del proyecto pidió expresamente diseñar un emblema circular con
silueta de jamón, así que la regla queda levantada solo para esta propuesta. **No debe presentarse
como el sello oficial de la D.O.** Sustituir por el emblema real del Consejo Regulador antes de
cualquier uso público.

**Excepciones registradas en el detector** (`.impeccable/config.json`), todas con motivo:

- `low-contrast` para los pares `#fcf8f0 on #fcf8f0` y `#e8d5c8 on #fcf8f0`: falsos positivos, son
  tokens que solo se pintan dentro del panel granate.
- `cream-palette`: el fondo crema lo fija el encargo, por hexadecimal.

El aviso de `wide-tracking` **no se silenció: se corrigió**. El pie del sello, la etiqueta de
progreso y los títulos de los avisos estaban entre 0,08em y 0,14em en caja baja, y el tracking
ancho sin versalitas entorpece la lectura. La salida idiomática —poner esos rótulos en mayúsculas—
la descarta el propio encargo («Evita las mayúsculas sostenidas en las etiquetas»), así que se
bajaron a 0,04em. El lockup del sello lo sostienen ahora el filete dorado y el centrado. El único
tracking ancho que queda es «D.O.» a 0,2em: cuatro caracteres en versalita, que es justo el caso
para el que sirve.

## 2026-09-22 — La propuesta visual se lleva a la aplicación

`design/propuesta-visual.html` deja de ser solo una maqueta: el diseño está ahora en `src/`.
La maqueta se conserva como referencia de lo aprobado.

Qué cambió en la aplicación:

- **Paleta** (`tokens.css`): granate oscuro pasa de `#4a1526` a `#641933`, se añade
  `--color-gold: #c39a4b`, el texto pasa a `#3a2a2e` y las líneas a `#e7dfd2`. Los nombres de los
  alias semánticos no cambian, así que ningún componente tuvo que tocarse por esto.
- **Tipografía**: Spectral sustituye a Source Serif 4 (`@fontsource/source-serif-4` desinstalado).
- **Panel**: color base separado del degradado, filete dorado de 1 px en el canto, marca anclada
  arriba y enunciado centrado ópticamente. La barra de progreso se rellena en oro sobre el panel
  (`--progress-fill`), porque el vino sobre granate da 1,5:1.
- **Iconos**: `src/components/Icon.tsx` con nueve iconos de línea dibujados a mano (rejilla 24,
  trazo 1,5) y el sello. Sin librería de iconos y sin emoji.
- **Los iconos son dato, no código**: `Option` admite `icon?: OptionIcon`, y C-Q01 los declara. Una
  pregunta puede ganar o cambiar icono sin tocar un componente (regla 4 de CLAUDE.md). El icono es
  presentación: no se guarda, no se valida y no sale en los CSV.
- **Portada**: la pantalla de bienvenida muestra el sello y «Denominación de Origen Protegida» en
  el área crema, que antes estaba vacía. Es el desarrollo literal de «D.O.», no texto inventado.
- **`StatusMessage`**: se retira el borde lateral de 4 px. Un `border-inline-start` de color por
  encima de 1 px es un disfraz de jerarquía; el tono lo llevan ahora el relleno, un borde completo
  de 1 px y el color del texto.

El sello sigue siendo **un marcador de posición**, ahora en `src/components/Icon.tsx` con la misma
advertencia: no es la marca oficial del Consejo Regulador y no debe presentarse como tal.

266 tests en verde, cero avisos del detector sobre `src/`.

## 2026-09-22 — La pregunta pasa a ir encima de las respuestas

La composición a dos columnas —pregunta en el panel granate de la izquierda, respuestas en la
crema de la derecha— obligaba al ojo a ir y volver en cada pantalla. En una encuesta que se
rellena en cinco minutos eso cansa y ralentiza. El responsable del proyecto lo señaló al probarla.

Ahora hay **una sola composición**: banda granate a todo el ancho con la marca, el progreso y la
pregunta, y las respuestas debajo sobre crema.

Lo que hace que funcione, y que no se debe romper: **la banda es full-bleed pero su contenido
interior comparte el mismo contenedor de `--measure` que las respuestas**. El enunciado y la
primera opción caen en el mismo eje vertical, así que la lectura baja en línea recta. Si alguien
separa esas medidas, la banda vuelve a partir la lectura y el cambio pierde su sentido.
`tests/screens/Screen.test.tsx` fija el orden del DOM con `compareDocumentPosition` para que la
pregunta no pueda volver a colocarse al lado sin que salte un test.

`--measure` sube de 34rem a 42rem: 65–75 caracteres por línea, que es donde mejor se lee, y da
sitio holgado a la matriz de cinco columnas.

El pie queda fijo con un degradado encima, para que «Atrás» y «Siguiente» estén siempre a mano y
una lista larga se lea como «hay más abajo» y no como una tarjeta recortada.

### Se retira el sistema de dos vistas

Con una sola composición, el botón «Vista horizontal / Vista vertical» no tenía nada que alternar.
Se borran `ViewToggle.tsx`, `ViewToggle.css`, `state/useViewMode.ts` y `tests/state/viewMode.test.ts`,
y desaparece la prop `forceStacked` de `Screen` y de sus cuatro usos en el panel de administración
y la guía de estilo.

**Esto anula la DEVIATION 4**, que se ha eliminado de este registro: `useViewMode` era el único
punto de la aplicación que tocaba `localStorage`. El proyecto vuelve a cumplir la regla §6.2 del
blueprint sin ninguna excepción, y el guard de `tests/guards/no-network.test.ts` se simplifica a
«ningún fichero de `src/` toca el almacenamiento del navegador», con una comprobación añadida para
`document.cookie`.

252 tests en verde, cero hallazgos del detector sobre `src/`.

## 2026-09-23 — Las marcas reales llegan a la portada

Llegan los logotipos oficiales, así que **desaparece el sello inventado** de toda la aplicación:
se borra `Seal` de `Icon.tsx`, las variables `--seal-knockout` y su uso en `Logo`. Con ello se
cierra el cabo suelto de la regla 6 de `CLAUDE.md` que venía arrastrándose desde la primera
entrega.

- `public/logo-jamon-de-teruel.png` — D.O.P., 129 × 155
- `public/logo-cerdo-de-teruel.png` — I.G.P., 135 × 68

Van **en la portada, sobre crema**. No se meten en la banda granate porque son rojo y rosa sobre
transparente: sobre `#7B2140` se perderían. La banda conserva el rótulo tipográfico blanco, que es
lo que sí contrasta. `Logo.tsx` explica ese motivo en su comentario, por si alguien intenta
meterlos ahí más adelante; si el Consejo facilita una versión en blanco, basta con apuntar
`LOGO_SRC` a ella.

Se muestran por debajo de su tamaño original (112 px y 60 px de alto) para que no se vean blandos.
**Conviene pedir los SVG**: a esta resolución la línea «Indicación Geográfica Protegida» del
segundo logotipo es ilegible, y no sirven para impresión.

**Cerdo de Teruel es una I.G.P. distinta de la D.O.P. Jamón de Teruel.** Mostrar ambas en la
portada de una encuesta de la D.O. es una decisión de comunicación, no de diseño: conviene que
alguien del Consejo la confirme antes de salir a campo.

### Otros ajustes de la misma ronda

- **Fuera el subtítulo de la portada** («Sus respuestas son anónimas…»). El aviso completo de RGPD
  sigue donde importa: la pantalla de identificación, antes de contestar nada.
- **Fuera la duración estimada** de la elección de vía. `estimatedDuration` se mantiene en los datos
  —es parte del contrato del blueprint §5.1— pero deja de pintarse.
- **Un botón que va solo se centra.** Antes `margin-inline-start: auto` lo empujaba a la derecha, y
  en la portada eso se leía como un error: no había nada a la izquierda que lo equilibrase.
- **Nueva prop `align` en `Screen`**, con `center` para portada y pantalla final. Las pantallas de
  pregunta siguen en `start`: una lista de opciones centrada pierde el borde izquierdo común que el
  ojo usa para encontrar cada línea.
- **La barra de progreso pasa de oro a blanco** (`--color-panel-fill`), 9,29:1 sobre el granate. El
  oro queda solo en el «D.O.» del rótulo y en el filete de 1 px, que es la moderación que pedía el
  encargo.

261 tests en verde, cero hallazgos del detector sobre `src/`.

## 2026-09-23 — Entra CIRCE, y el rótulo se centra en la portada

`public/logo-circe.png` (color, 1022 × 567) y `public/logo-circe-blanco.png` (reversado,
4054 × 2217). Ambos con transparencia y en mejor resolución que las marcas de Teruel.

- **Portada**: los tres logotipos en una fila, sobre crema. Las alturas están ajustadas por **peso
  óptico, no por altura idéntica**: el lockup de Jamón es vertical y apilado, los otros dos son
  apaisados; igualarlos en píxeles habría dejado el texto de Jamón ilegible.
- **Resto de pantallas**: la versión blanca al extremo derecho de la banda, a 2,1 rem. Es
  atribución, no la marca del cuestionario, así que va menor que el rótulo. La versión en color no
  sirve ahí: su tipografía azul marino sobre granate no contrasta.
- **El rótulo «D.O. Jamón de Teruel» se centra en las pantallas con `align="center"`.** Estaba a la
  izquierda mientras el título salía centrado, porque `.screen__brand` solo igualaba el eje
  transversal. Nueva prop `showPartner`, que la portada apaga porque ya enseña CIRCE en grande.

**Reserva planteada y desestimada por el responsable del proyecto**: poner los tres logotipos al
mismo nivel sugiere visualmente que CIRCE es cotitular de la denominación, cuando su papel es
realizar el estudio. Se propuso subordinarlo —menor y en línea aparte— y se optó por la fila de
iguales. Queda anotado por si el Consejo Regulador lo comenta.

**Pendiente**: `logo-circe-blanco.png` pesa 94 KB para mostrarse a 34 px de alto. Conviene
reescalarlo antes de salir a campo, sobre todo para móviles con datos.

266 tests en verde, cero hallazgos del detector sobre `src/`.

## 2026-09-23 — El título de la portada va a una línea

«Cuestionario D.O. Jamón de Teruel» se partía en dos líneas por el tope de 26 caracteres de
`.screen__title` y por la medida de lectura de la banda. Nueva prop `wideTitle`, que **solo usa la
portada**: allí la banda se ensancha a `--measure-wide` y el título pierde el tope.

Romper la medida compartida es admisible ahí y solo ahí: la portada no tiene lista de opciones
debajo con la que compartir eje vertical, que es la razón de ser de esa medida en las pantallas de
pregunta. En estrecho el título vuelve a partir con normalidad.

## 2026-09-23 — Backend local de desarrollo, y el panel probado de punta a punta

El panel de administración llevaba varias rondas escrito y con tests, pero nadie lo había visto
funcionar: sin `.env` ni proyecto de Supabase, arrancaba y no podía hablar con nada.

**`dev/api.ts`** sirve las seis rutas `/api/...` contra un array en memoria. Reutiliza toda la
lógica real —`validateSubmission`, `verifyPassword`, `parseListFilters`, `buildWideCsv`,
`buildLongCsv`—; lo único propio del modo desarrollo es dónde se guardan las filas y el despacho
de rutas. Se monta desde `vite.config.mts` con `apply: 'serve'`, así que **no entra en producción**:
en Vercel siguen mandando los handlers de `api/`.

`dev/seed.ts` siembra tres respuestas rotuladas **EJEMPLO** para poder revisar el listado, la ficha
y sobre todo las columnas del CSV sin rellenar nada. Se pierden al reiniciar: no es una base de
datos.

El riesgo de tener dos implementaciones de las mismas rutas se acota con
`tests/guards/dev-isolation.test.ts`, que falla si algo de `src/` o `api/` llega a importar de
`dev/`.

**`.env`** creado con `ADMIN_PASSWORD_HASH` y `ADMIN_SESSION_SECRET` ya generados. La contraseña
se entregó por chat y no está escrita en ningún fichero del repositorio. Vite solo expone las
variables con prefijo `VITE_` y solo al navegador, así que la configuración carga `.env` en
`process.env` con `loadEnv`, **solo durante `serve`**.

### Dos cosas que salieron de probarlo de verdad

- **`EXPORT_LIMIT` pasa de 1000 a 5000.** El censo de empresas son ~200, pero la encuesta de
  consumidores puede pasar de mil y el CSV se habría cortado **en silencio**. Un análisis sobre
  datos truncados sin avisar es peor que no tener datos. El listado muestra además el recuento,
  para poder compararlo con las filas del CSV.
- **La pantalla final prometía anonimato a las empresas.** `sentDetail` decía «se tratará de forma
  anónima» a todo el mundo, incluidas las empresas que acababan de dar su nombre — la misma
  incoherencia que ya se corrigió en la pantalla de identificación y que aquí se había pasado por
  alto. Ahora hay dos textos, `sentDetailCompany` y `sentDetailIndividual`.

Recorrido comprobado en local: cuestionario de empresa completo → «Sus respuestas han quedado
registradas» → login en `/admin` → listado con filtros → CSV ancho (4 filas, 65 columnas) y largo
(97 filas, 15 columnas), ambos con BOM UTF-8, separador `;`, CRLF y acentos correctos.

273 tests en verde.

## 2026-09-23 — Revisión visual del panel, unidad en la ficha y limpieza

Al mirar por fin el panel con capturas —hasta ahora solo lo había verificado por API— apareció un
fallo real: los precios de la batería Van Westendorp se leían como **«9»** y **«16»**, sin el
`€/kg`. Un número sin unidad es ambiguo para quien lee la respuesta: ¿nueve euros, nueve kilos,
nueve años?

`SnapshotQuestion` gana un campo `unit`, que `buildSnapshot` rellena para las preguntas de tipo
`number`. Va en el **snapshot** y no se lee del cuestionario actual, para que una respuesta
antigua se relea con la unidad con la que se recogió.

**La ficha lo muestra; el CSV no.** Es deliberado: en la exportación la unidad ya está en el
encabezado de la columna, y concatenarla al valor convertiría una columna numérica en texto, que
es justo lo que rompe un análisis en Excel o en R.

### Reescalado del logotipo blanco de CIRCE

De 4054 × 2217 y 94 KB a **187 × 102 y 6,1 KB**, tres veces el tamaño al que se muestra (34 px),
así que sigue nítido en pantallas retina. Se hizo con el canvas de Chrome headless, sin añadir
ninguna dependencia de imagen al proyecto. `public/` pasa de 135 KB a 52 KB en total, que importa
en un móvil con datos en una feria.

### Repositorio inicializado

Primer commit con 130 ficheros. Comprobado antes de confirmar que **ni `.env`, ni el hash de la
contraseña, ni el secreto de sesión, ni la contraseña en claro** aparecen en lo versionado.
`.env.example` sí se versiona: es la plantilla y no lleva valores.

Queda pendiente crear el remoto y conectar Vercel, que requiere cuenta.

## 2026-09-24 — Las funciones de Vercel no arrancaban: faltaban las extensiones

Tras el primer despliegue, `/api/*` devolvía `FUNCTION_INVOCATION_FAILED`: un fallo de plataforma,
no nuestro. Que no saliera el JSON de `withErrorHandling` es el dato clave — **la función se rompía
al cargar el módulo**, antes de ejecutar ninguna línea nuestra.

Causa: `package.json` declara `"type": "module"`, así que Node aplica las reglas ESM, y **ESM exige
la extensión explícita** en los import relativos. Los ficheros de `api/`, `server/`, `src/data/` y
`dev/` importaban sin ella (`'../server/http'`), y además había imports de carpeta
(`'../src/data/questionnaires'`), que en ESM no existen.

Arreglado en 20 ficheros: extensión `.js` explícita y `/index.js` en los imports de carpeta. Es la
convención estándar de TypeScript con ESM — se escribe `.js` porque es lo que tendrá el fichero
compilado. Funciona en los dos escenarios posibles: si Vercel empaqueta con esbuild, éste reescribe
`.js` a `.ts` al resolver; si compila y ejecuta con Node ESM, la ruta ya es la correcta. Vite y
Vitest hacen la misma reescritura, así que el entorno local no cambia.

**Aviso honesto**: esto corrige un defecto real y verificado —el código no era ESM válido—, pero no
he podido confirmar que sea la única causa del fallo en producción, porque no tengo acceso a los
registros de Vercel. Si tras redesplegar sigue fallando, el registro de la función dirá el error
exacto en una línea.

### Contraseña del panel

Cambiada a la elegida por el responsable del proyecto. **Reserva planteada**: el comentario de
`server/auth.ts` justifica usar SHA-256 plano precisamente porque la contraseña era larga y
aleatoria. Una contraseña corta y con estructura reconocible debilita ese razonamiento, y el
limitador de peticiones apenas protege en serverless, donde se reinicia en cada instancia fría.
