import type { SupabaseClient } from '@supabase/supabase-js'
import type { QuestionnaireSnapshot } from '../src/data/snapshot'
import type { Answers, AudienceId } from '../src/data/types'
import { createServiceClient } from './supabaseClient'
import { DEFAULT_LIST_LIMIT, EXPORT_LIMIT } from './listFilters'
import type { ListFilters } from './listFilters'
import type { ValidSubmission } from './validateSubmission'

/** One row as it comes back from Postgres. */
export interface ResponseRow {
  id: string
  created_at: string
  respondent_type: AudienceId
  identification: Record<string, string | number>
  questionnaire_id: string
  questionnaire_version: string
  answers: Answers
  questionnaire: QuestionnaireSnapshot
  open_answer: string | null
}

/** The trimmed shape the admin list renders. */
export interface ResponseListRow {
  id: string
  created_at: string
  respondent_type: AudienceId
  identification: Record<string, string | number>
  questionnaire_version: string
  answers: Answers
}

const LIST_COLUMNS = 'id, created_at, respondent_type, identification, questionnaire_version, answers'
const TABLE = 'responses'

export async function insertResponse(
  submission: ValidSubmission,
  client: SupabaseClient = createServiceClient(),
): Promise<string> {
  const { data, error } = await client
    .from(TABLE)
    .insert({
      respondent_type: submission.audience,
      identification: submission.identification,
      questionnaire_id: submission.questionnaireId,
      questionnaire_version: submission.questionnaireVersion,
      answers: submission.answers,
      questionnaire: submission.snapshot,
      open_answer: submission.openAnswer,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Could not save the response: ${error.message}`)
  return (data as { id: string }).id
}

/**
 * Shared by the list and the export so the CSV can never diverge from what
 * the admin sees on screen. Only the selected columns and the limit differ.
 */
export function buildQuery(client: SupabaseClient, columns: string, filters: ListFilters) {
  let query = client.from(TABLE).select(columns)

  if (filters.respondentType) query = query.eq('respondent_type', filters.respondentType)
  if (filters.search) query = query.ilike('identification::text', `%${filters.search}%`)

  return query.order(filters.orderBy, { ascending: filters.ascending }).limit(filters.limit)
}

export async function listResponses(
  filters: ListFilters,
  client: SupabaseClient = createServiceClient(),
): Promise<ResponseListRow[]> {
  const { data, error } = await buildQuery(client, LIST_COLUMNS, {
    ...filters,
    limit: Math.min(filters.limit, DEFAULT_LIST_LIMIT),
  })

  if (error) throw new Error(`Could not read the responses: ${error.message}`)
  return (data ?? []) as unknown as ResponseListRow[]
}

export async function getResponse(
  id: string,
  client: SupabaseClient = createServiceClient(),
): Promise<ResponseRow | null> {
  const { data, error } = await client.from(TABLE).select('*').eq('id', id).maybeSingle()

  if (error) throw new Error(`Could not read the response: ${error.message}`)
  return (data as ResponseRow | null) ?? null
}

export async function listResponsesForExport(
  filters: ListFilters,
  client: SupabaseClient = createServiceClient(),
): Promise<ResponseRow[]> {
  const { data, error } = await buildQuery(client, '*', {
    ...filters,
    limit: Math.min(filters.limit, EXPORT_LIMIT),
  })

  if (error) throw new Error(`Could not read the responses: ${error.message}`)
  return (data ?? []) as unknown as ResponseRow[]
}
