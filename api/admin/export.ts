import { methodNotAllowed, singleParam, withErrorHandling } from '../../server/http.js'
import type { ApiRequest, ApiResponse } from '../../server/http.js'
import { hasValidAdminSession } from '../../server/auth.js'
import { attachment } from '../../server/csv.js'
import {
  buildCodebookCsv,
  buildCodebookJson,
  buildFrequencyCsv,
  buildMatrixCsv,
  buildStatisticsCsv,
  exportFilename,
} from '../../server/exports.js'
import { buildMicrodataCsv, buildOpenTextCsv } from '../../server/microdata.js'
import type { ExportFormat } from '../../server/exports.js'
import { EXPORT_LIMIT, parseListFilters } from '../../server/listFilters.js'
import { getResponse, listResponsesForExport } from '../../server/responsesRepository.js'

export default withErrorHandling(async (req: ApiRequest, res: ApiResponse) => {
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET')
  if (!hasValidAdminSession(req)) {
    res.status(401).json({ error: 'Invalid session.' })
    return
  }

  const format = (singleParam(req.query, 'format') ?? 'matrix') as ExportFormat
  if (!BUILDERS[format]) {
    res.status(400).json({ error: `format must be one of: ${Object.keys(BUILDERS).join(', ')}.` })
    return
  }

  // A single response exports as a matrix whatever was asked for: a frequency
  // table over one respondent is a column of ones.
  const id = singleParam(req.query, 'id')
  if (id) {
    const response = await getResponse(id)
    if (!response) {
      res.status(404).json({ error: 'Response not found.' })
      return
    }
    sendCsv(res, `respuesta-${id}.csv`, buildMatrixCsv([response]))
    return
  }

  const filters = parseListFilters(req, EXPORT_LIMIT)
  const rows = await listResponsesForExport(filters)
  sendCsv(res, exportFilename(format, filters.respondentType), BUILDERS[format](rows))
})

const BUILDERS: Record<ExportFormat, (rows: Parameters<typeof buildMatrixCsv>[0]) => string> = {
  microdata: buildMicrodataCsv,
  opentext: buildOpenTextCsv,
  matrix: buildMatrixCsv,
  frequency: buildFrequencyCsv,
  statistics: buildStatisticsCsv,
  codebook: buildCodebookCsv,
  codebookJson: buildCodebookJson,
}

function sendCsv(res: ApiResponse, filename: string, csv: string): void {
  const type = filename.endsWith('.json') ? 'application/json' : 'text/csv'
  res.setHeader('Content-Type', `${type}; charset=utf-8`)
  res.setHeader('Content-Disposition', attachment(filename))
  res.status(200).send(csv)
}
