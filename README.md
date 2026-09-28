# D.O. Jamón de Teruel — capa de datos del cuestionario

Cómo salen los datos de la aplicación, qué hay en cada fichero y cómo leerlo.
Para el funcionamiento de la aplicación, ver `MAINTENANCE.md`; para por qué las
cosas son como son, `DECISIONS.md`.

## Un solo comando

```bash
npm run export                 # escribe en ./export
npm run export -- --out ruta   # o donde se quiera
```

Lee Supabase con la clave de servicio, así que necesita `SUPABASE_URL` y
`SUPABASE_SERVICE_ROLE_KEY` en `.env`. Nunca se ejecuta en el navegador.

Los mismos ficheros se descargan uno a uno desde el panel de administración.

## Qué se genera, por público

| Fichero | Qué es |
| --- | --- |
| `microdatos-<público>.csv` | **Una fila por respondente.** De aquí sale todo lo demás |
| `texto-abierto-<público>.csv` | Las respuestas en palabras, formato largo |
| `frecuencias-<público>.csv` | Distribuciones: cada pregunta, cada opción, cuántos |
| `estadisticos-<público>.csv` | Medias, medianas, mínimos y máximos |
| `diccionario-<público>.csv` · `.json` | Qué significa cada columna |
| `respuestas-<público>.csv` | La misma información que los microdatos, con rótulos en español y el nombre de la empresa, para el Consejo |

## Dos formatos, a propósito distintos

No hay que unificarlos.

| | Separador | Decimal | BOM | Para |
| --- | --- | --- | --- | --- |
| **Máquina** | `,` | `.` | no | `microdatos`, `texto-abierto` |
| **Excel-ES** | `;` | `,` | sí | el resto |

El 24/09/2026 un decimal con punto (`18.5`) lo leyó Excel en español **como
texto**, y las cuatro preguntas de precio dejaron de poder promediarse. Por eso
los ficheros que se abren a mano llevan coma decimal y `;`. Y por eso los
microdatos llevan lo contrario: un BOM sale como un carácter raro en el nombre
de la primera columna en la mitad de los lectores de R y Python.
`tests/server/microdata.test.ts` fija los dos perfiles para que un refactor
futuro no los «arregle» juntándolos.

## Cómo se leen los microdatos

Una columna por cosa contestable, nombrada por su **código**: `C-Q01`,
`C-Q05.local`, `C-Q15.aporta-valor`. El código no cambia nunca, aunque se
reescriba la pregunta.

| Tipo de pregunta | Columnas | Valor |
| --- | --- | --- |
| Elección única | una | el código de la opción (`matadero`) |
| Elección múltiple | una por opción, más `.n_selected` | `1` marcada, `0` no marcada |
| Escala y rejilla | una por ítem | el número |
| Numérica | una | el número, con punto decimal |
| Texto | una | `1` escribió algo, `0` lo dejó en blanco |

### Los tres valores negativos

Una celda vacía no distingue «no se le preguntó» de «se le preguntó y no
contestó», y esa diferencia decide si una base es 30 o 120. Por eso:

| | Significa |
| --- | --- |
| `-97` | No se le mostró la pregunta |
| `-98` | Declinó contestar |
| `-99` | Se le preguntó y no contestó |

**Hay que filtrarlos antes de calcular nada.** Quien promedie una columna sin
quitarlos obtiene un número sin sentido. Están declarados en el diccionario
JSON, en `sentinels`.

Nota: `-98` no aparece todavía. No hay ningún «prefiero no contestar» en la
aplicación; la opción más parecida es «Prefiero no decirlo» de I-Q02, que es
una respuesta con su propio código. La columna existe definida y sin usar.

## Segmentar es trabajo del analista

Los microdatos no llevan columnas de segmento. Se cruza lo que haga falta con
una tabla dinámica o un `group_by`.

El fichero de frecuencias sí trae unos cuantos cortes ya hechos, por comodidad
de quien no va a montar una pivot. Lleva una columna **`Aviso`**: cuando dos
variables reparten a los respondentes exactamente igual, la segunda no aporta
un corte nuevo y se dice ahí y en el registro de la orden.

## Límite de la muestra, que condiciona todo lo anterior

El cuestionario es **un enlace abierto**. No hay lista de invitados ni censo
conocido de operadores de la D.O., así que:

- **No existe tasa de respuesta**, y ningún campo la puede fabricar. Haría
  falta antes un mecanismo de invitación, que es un cambio de producto.
- **La muestra es autoseleccionada y no probabilística.** Los resultados
  describen a quien contestó. No se pueden proyectar a la población del sector
  ni presentarse como «el x % de las empresas de la D.O.».
- **No se puede ponderar** a la población por la misma razón.

Esto no es un defecto que se arregle con más columnas: es lo que el diseño de
campo permite decir. Conviene que figure en cualquier informe que salga de
aquí.

Y un recordatorio de confidencialidad: el aviso a las empresas promete
publicación agregada. **Un grupo con menos de cinco respuestas no se publica**
— la columna `Respondieron` lleva el tamaño en cada línea.

## Códigos y oleadas

`src/data/codeRegistry.json` guarda cada código con la oleada en que apareció.
Es lo que hace comparable una oleada con la siguiente. `tests/data/codes.test.ts`
falla si un código se reutiliza, se renombra o desaparece sin marcarse como
retirado.

La **oleada** (`wave`) se sella en el servidor desde la variable `WAVE`, y no es
lo mismo que `questionnaire_version`: el contenido cambió a mitad de la oleada
el 28/09/2026, así que las dos se mueven por su cuenta.
