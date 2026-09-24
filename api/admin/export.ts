import { methodNotAllowed, singleParam, withErrorHandling } from '../../server/http.js'
import type { ApiRequest, ApiResponse } from '../../server/http.js'
import { hasValidAdminSession } from '../../server/auth.js'
import { attachment } from '../../server/csv.js'
import { buildLongCsv, buildWideCsv } from '../../server/exports.js'
import { EXPORT_LIMIT, parseListFilters } from '../../server/listFilters.js'
import { getResponse, listResponsesForExport } from '../../server/responsesRepository.js'

export default withErrorHandling(async (req: ApiRequest, res: ApiResponse) => {
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET')
  if (!hasValidAdminSession(req)) {
    res.status(401).json({ error: 'Invalid session.' })
    return
  }

  const format = singleParam(req.query, 'format') ?? 'wide'
  if (format !== 'wide' && format !== 'long') {
    res.status(400).json({ error: 'format must be "wide" or "long".' })
    return
  }

  // A single response exports as long only: one wide row is not useful.
  const id = singleParam(req.query, 'id')
  if (id) {
    const response = await getResponse(id)
    if (!response) {
      res.status(404).json({ error: 'Response not found.' })
      return
    }
    sendCsv(res, `response-${id}-long.csv`, buildLongCsv([response]))
    return
  }

  const rows = await listResponsesForExport(parseListFilters(req, EXPORT_LIMIT))
  const csv = format === 'wide' ? buildWideCsv(rows) : buildLongCsv(rows)
  sendCsv(res, `responses-${format}.csv`, csv)
})

function sendCsv(res: ApiResponse, filename: string, csv: string): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', attachment(filename))
  res.status(200).send(csv)
}
