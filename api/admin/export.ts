import { methodNotAllowed, singleParam, withErrorHandling } from '../../server/http.js'
import type { ApiRequest, ApiResponse } from '../../server/http.js'
import { hasValidAdminSession } from '../../server/auth.js'
import { attachment } from '../../server/csv.js'
import { buildFrequencyCsv, buildMatrixCsv, exportFilename } from '../../server/exports.js'
import { EXPORT_LIMIT, parseListFilters } from '../../server/listFilters.js'
import { getResponse, listResponsesForExport } from '../../server/responsesRepository.js'

export default withErrorHandling(async (req: ApiRequest, res: ApiResponse) => {
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET')
  if (!hasValidAdminSession(req)) {
    res.status(401).json({ error: 'Invalid session.' })
    return
  }

  const format = singleParam(req.query, 'format') ?? 'matrix'
  if (format !== 'matrix' && format !== 'frequency') {
    res.status(400).json({ error: 'format must be "matrix" or "frequency".' })
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
  const csv = format === 'matrix' ? buildMatrixCsv(rows) : buildFrequencyCsv(rows)
  sendCsv(res, exportFilename(format, filters.respondentType), csv)
})

function sendCsv(res: ApiResponse, filename: string, csv: string): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', attachment(filename))
  res.status(200).send(csv)
}
