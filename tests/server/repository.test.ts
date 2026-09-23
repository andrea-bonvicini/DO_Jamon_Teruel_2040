import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildQuery,
  getResponse,
  insertResponse,
  listResponses,
  listResponsesForExport,
} from '../../server/responsesRepository'
import { DEFAULT_LIST_LIMIT, EXPORT_LIMIT, parseListFilters } from '../../server/listFilters'
import type { ListFilters } from '../../server/listFilters'
import type { ValidSubmission } from '../../server/validateSubmission'
import { QUESTIONNAIRES } from '../../src/data/questionnaires'
import { buildSnapshot } from '../../src/data/snapshot'
import type { Answers } from '../../src/data/types'

const baseFilters: ListFilters = {
  search: null,
  respondentType: null,
  orderBy: 'created_at',
  ascending: false,
  limit: DEFAULT_LIST_LIMIT,
}

/** A chainable stub that records every call the repository makes. */
function fakeClient(result: { data?: unknown; error?: { message: string } | null } = {}) {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const record = (method: string) =>
    vi.fn((...args: unknown[]) => {
      calls.push({ method, args })
      return builder
    })

  // `data: null` must stay null — it is how Supabase reports "no row".
  const settled = { data: 'data' in result ? result.data : [], error: result.error ?? null }

  const builder: Record<string, unknown> = {
    select: record('select'),
    eq: record('eq'),
    ilike: record('ilike'),
    order: record('order'),
    limit: record('limit'),
    insert: record('insert'),
    single: vi.fn(() => {
      calls.push({ method: 'single', args: [] })
      return Promise.resolve(settled)
    }),
    maybeSingle: vi.fn(() => {
      calls.push({ method: 'maybeSingle', args: [] })
      return Promise.resolve(settled)
    }),
    // Awaiting the builder itself resolves the query — that is exactly how
    // the real Supabase query builder behaves, so the stub must too.
    // oxlint-disable-next-line no-thenable
    then: (resolve: (value: typeof settled) => unknown) => Promise.resolve(settled).then(resolve),
  }

  const client = { from: record('from') } as unknown as SupabaseClient
  return { client, calls, builder }
}

const answers: Answers = { 'C-Q01': { kind: 'option', optionId: 'secadero' } }

const submission: ValidSubmission = {
  audience: 'company',
  questionnaireId: 'company',
  questionnaireVersion: QUESTIONNAIRES.company.version,
  identification: { role: 'Gerente' },
  answers,
  openAnswer: 'Más promoción',
  snapshot: buildSnapshot(QUESTIONNAIRES.company, answers),
}

describe('insertResponse', () => {
  it('maps the camelCase payload onto snake_case columns', async () => {
    const { client, calls } = fakeClient({ data: { id: 'new-id' } })
    const id = await insertResponse(submission, client)

    expect(id).toBe('new-id')
    expect(calls.find((call) => call.method === 'from')?.args[0]).toBe('responses')

    const inserted = calls.find((call) => call.method === 'insert')?.args[0]
    expect(inserted).toEqual({
      respondent_type: 'company',
      identification: { role: 'Gerente' },
      questionnaire_id: 'company',
      questionnaire_version: QUESTIONNAIRES.company.version,
      answers,
      questionnaire: submission.snapshot,
      open_answer: 'Más promoción',
    })
  })

  it('throws a readable error when the insert fails', async () => {
    const { client } = fakeClient({ error: { message: 'duplicate key' } })
    await expect(insertResponse(submission, client)).rejects.toThrow(
      'Could not save the response: duplicate key',
    )
  })
})

describe('buildQuery', () => {
  it('applies no filter clauses when nothing is set', () => {
    const { client, calls } = fakeClient()
    buildQuery(client, 'id', baseFilters)

    expect(calls.some((call) => call.method === 'eq')).toBe(false)
    expect(calls.some((call) => call.method === 'ilike')).toBe(false)
    expect(calls.find((call) => call.method === 'order')?.args).toEqual([
      'created_at',
      { ascending: false },
    ])
  })

  it('filters by respondent type', () => {
    const { client, calls } = fakeClient()
    buildQuery(client, 'id', { ...baseFilters, respondentType: 'individual' })

    expect(calls.find((call) => call.method === 'eq')?.args).toEqual([
      'respondent_type',
      'individual',
    ])
  })

  it('searches the identification blob with a wildcard ilike', () => {
    const { client, calls } = fakeClient()
    buildQuery(client, 'id', { ...baseFilters, search: 'teruel' })

    expect(calls.find((call) => call.method === 'ilike')?.args).toEqual([
      'identification::text',
      '%teruel%',
    ])
  })

  it('honours the ascending flag', () => {
    const { client, calls } = fakeClient()
    buildQuery(client, 'id', { ...baseFilters, ascending: true })
    expect(calls.find((call) => call.method === 'order')?.args[1]).toEqual({ ascending: true })
  })
})

describe('the shared query builder', () => {
  it('gives the list five columns and the default limit', async () => {
    const { client, calls } = fakeClient({ data: [] })
    await listResponses(baseFilters, client)

    const columns = String(calls.find((call) => call.method === 'select')?.args[0])
    expect(columns.split(',').map((part) => part.trim())).toEqual([
      'id',
      'created_at',
      'respondent_type',
      'identification',
      'questionnaire_version',
      'answers',
    ])
    expect(calls.find((call) => call.method === 'limit')?.args[0]).toBe(DEFAULT_LIST_LIMIT)
  })

  it('gives the export every column and its own hard limit', async () => {
    const { client, calls } = fakeClient({ data: [] })
    await listResponsesForExport({ ...baseFilters, limit: EXPORT_LIMIT }, client)

    expect(calls.find((call) => call.method === 'select')?.args[0]).toBe('*')
    expect(calls.find((call) => call.method === 'limit')?.args[0]).toBe(EXPORT_LIMIT)
  })

  it('caps the export at 1000 rows even if a larger limit is asked for', async () => {
    const { client, calls } = fakeClient({ data: [] })
    await listResponsesForExport({ ...baseFilters, limit: 99_999 }, client)
    expect(calls.find((call) => call.method === 'limit')?.args[0]).toBe(EXPORT_LIMIT)
  })

  it('applies the SAME filters to the list and the export', async () => {
    const filters = { ...baseFilters, search: 'teruel', respondentType: 'company' as const }

    const list = fakeClient({ data: [] })
    await listResponses(filters, list.client)
    const exported = fakeClient({ data: [] })
    await listResponsesForExport(filters, exported.client)

    const clauses = (calls: typeof list.calls) =>
      calls.filter((call) => call.method === 'eq' || call.method === 'ilike')

    expect(clauses(list.calls)).toEqual(clauses(exported.calls))
  })
})

describe('getResponse', () => {
  it('selects everything for one id', async () => {
    const { client, calls } = fakeClient({ data: { id: 'abc' } })
    const row = await getResponse('abc', client)

    expect(calls.find((call) => call.method === 'select')?.args[0]).toBe('*')
    expect(calls.find((call) => call.method === 'eq')?.args).toEqual(['id', 'abc'])
    expect(row).toEqual({ id: 'abc' })
  })

  it('returns null for an unknown id rather than throwing', async () => {
    const { client } = fakeClient({ data: null })
    expect(await getResponse('missing', client)).toBeNull()
  })
})

const req = (query: Record<string, string>) => ({ headers: {}, query })

describe('parseListFilters', () => {
  it('defaults to newest first with the default limit', () => {
    expect(parseListFilters({ headers: {} })).toEqual({
      search: null,
      respondentType: null,
      orderBy: 'created_at',
      ascending: false,
      limit: DEFAULT_LIST_LIMIT,
    })
  })

  it('trims the search term and drops an empty one', () => {
    expect(parseListFilters(req({ search: '  teruel  ' })).search).toBe('teruel')
    expect(parseListFilters(req({ search: '   ' })).search).toBeNull()
  })

  it('caps a very long search term', () => {
    expect(parseListFilters(req({ search: 'a'.repeat(500) })).search).toHaveLength(200)
  })

  it('accepts only the two known respondent types', () => {
    expect(parseListFilters(req({ type: 'company' })).respondentType).toBe('company')
    expect(parseListFilters(req({ type: 'aliens' })).respondentType).toBeNull()
  })

  it('treats only "asc" as ascending', () => {
    expect(parseListFilters(req({ direction: 'asc' })).ascending).toBe(true)
    expect(parseListFilters(req({ direction: 'sideways' })).ascending).toBe(false)
  })

  it('clamps the limit to the caller-supplied maximum', () => {
    expect(parseListFilters(req({ limit: '50' })).limit).toBe(50)
    expect(parseListFilters(req({ limit: '9999' })).limit).toBe(DEFAULT_LIST_LIMIT)
    expect(parseListFilters(req({ limit: '-5' })).limit).toBe(DEFAULT_LIST_LIMIT)
    expect(parseListFilters(req({ limit: 'many' })).limit).toBe(DEFAULT_LIST_LIMIT)
  })

  it('takes the first value of a repeated parameter', () => {
    const filters = parseListFilters({ headers: {}, query: { type: ['individual', 'company'] } })
    expect(filters.respondentType).toBe('individual')
  })
})
