/**
 * Regenerates every analysis file from Supabase, in one command:
 *
 *   npm run export -- --out ./export
 *
 * Reads with the service-role key, so it runs on a machine that has `.env`,
 * never in the browser. Writes, per audience:
 *
 *   microdatos-<público>.csv    one line per respondent — the source of truth
 *   texto-abierto-<público>.csv the verbatims, long format
 *   frecuencias-<público>.csv   distributions, Excel-ES
 *   estadisticos-<público>.csv  computed statistics, Excel-ES
 *   diccionario-<público>.csv   the dictionary, Excel-ES
 *   diccionario-<público>.json  the same dictionary, for a program
 *
 * Any collinearity warning goes to stderr as well as into the files, so a
 * scheduled run surfaces it in the build log rather than only in a cell
 * somebody may never scroll to.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createServer } from 'vite'

/**
 * `.env` into `process.env`, before any server module reads it.
 *
 * Parsed here rather than with Node's `--env-file`, which silently declined
 * this file, and rather than with Vite's `loadEnv`, which puts the values on
 * `import.meta.env` — where the server modules are not looking.
 */
function loadDotEnv(path = '.env') {
  if (!existsSync(path)) return

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_]\w*)\s*=\s*(.*)$/.exec(line)
    if (!match) continue
    process.env[match[1]] ??= match[2].trim().replace(/^(['"])(.*)\1$/, '$2')
  }
}

loadDotEnv()

for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!process.env[name]) {
    console.error(`Falta ${name}. Esta orden lee Supabase con la clave de servicio:`)
    console.error('póngala en .env, y nunca en nada que llegue al navegador.')
    process.exit(1)
  }
}

const outDir = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : 'export'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })

try {
  const exports = await server.ssrLoadModule('/server/exports.ts')
  const microdata = await server.ssrLoadModule('/server/microdata.ts')
  const repository = await server.ssrLoadModule('/server/responsesRepository.ts')
  const { AUDIENCE_IDS } = await server.ssrLoadModule('/src/data/types.ts')

  const BUILDERS = {
    microdata: microdata.buildMicrodataCsv,
    opentext: microdata.buildOpenTextCsv,
    frequency: exports.buildFrequencyCsv,
    statistics: exports.buildStatisticsCsv,
    codebook: exports.buildCodebookCsv,
    codebookJson: exports.buildCodebookJson,
  }

  mkdirSync(outDir, { recursive: true })

  for (const audience of AUDIENCE_IDS) {
    const rows = await repository.listResponsesForExport({
      search: null,
      respondentType: audience,
      orderBy: 'created_at',
      ascending: true,
      limit: 5000,
    })

    for (const [format, build] of Object.entries(BUILDERS)) {
      writeFileSync(join(outDir, exports.exportFilename(format, audience)), build(rows), 'utf8')
    }

    console.info(`${audience}: ${rows.length} respuestas → ${outDir}`)
  }
} finally {
  await server.close()
}
