import { isAudienceId } from '../src/data/types.js'
import type { AudienceId } from '../src/data/types.js'
import { singleParam } from './http.js'
import type { ApiRequest } from './http.js'

export interface ListFilters {
  search: string | null
  respondentType: AudienceId | null
  orderBy: 'created_at'
  ascending: boolean
  limit: number
}

export const DEFAULT_LIST_LIMIT = 200
/**
 * Un export truncado en silencio arruina un análisis sin avisar. 5000 cubre
 * de sobra ambos censos; el listado muestra el recuento para poder
 * comprobarlo de un vistazo.
 */
export const EXPORT_LIMIT = 5000

/**
 * Parses and normalises the admin list query string. Anything unrecognised
 * falls back to the default rather than erroring: a stale bookmark should
 * still show the list.
 */
export function parseListFilters(req: ApiRequest, maxLimit = DEFAULT_LIST_LIMIT): ListFilters {
  const search = singleParam(req.query, 'search')?.trim()
  const type = singleParam(req.query, 'type')
  const direction = singleParam(req.query, 'direction')
  const limit = Number(singleParam(req.query, 'limit'))

  return {
    search: search ? search.slice(0, 200) : null,
    respondentType: isAudienceId(type) ? type : null,
    // Only one sort column exists today; the field keeps the query builder
    // honest if a second one is ever added.
    orderBy: 'created_at',
    ascending: direction === 'asc',
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, maxLimit) : maxLimit,
  }
}
