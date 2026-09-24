import type { QuestionnaireSnapshot } from '../data/snapshot'
import type { Answers, AudienceId } from '../data/types'

export class InvalidSessionError extends Error {}

export interface AdminListRow {
  id: string
  created_at: string
  respondent_type: AudienceId
  identification: Record<string, string | number>
  questionnaire_version: string
  answers: Answers
}

export interface AdminResponse extends AdminListRow {
  questionnaire_id: string
  questionnaire: QuestionnaireSnapshot
  open_answer: string | null
}

/** Real totals per audience, independent of the search box and the row cap. */
export type AdminCounts = Record<AudienceId, number>

export interface AdminListResult {
  responses: AdminListRow[]
  counts: AdminCounts
}

export interface AdminFilters {
  search?: string
  type?: AudienceId | ''
  direction?: 'asc' | 'desc'
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)

  if (response.status === 401) throw new InvalidSessionError('Invalid session.')
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Unexpected error (${response.status}).`)
  }

  return (await response.json()) as T
}

export function loginAdmin(password: string): Promise<{ ok: true }> {
  return request('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
}

export function logoutAdmin(): Promise<{ ok: true }> {
  return request('/api/admin/logout', { method: 'POST' })
}

export async function listResponsesAdmin(filters: AdminFilters): Promise<AdminListResult> {
  return request<AdminListResult>(`/api/admin/responses${queryString(filters)}`)
}

export async function getResponseAdmin(id: string): Promise<AdminResponse> {
  const body = await request<{ response: AdminResponse }>(
    `/api/admin/response?id=${encodeURIComponent(id)}`,
  )
  return body.response
}

/**
 * Returns a URL STRING, used as an `<a href>` so the browser sends the
 * session cookie and handles the download itself. Never fetched.
 */
export function exportUrl(format: 'wide' | 'long', filters: AdminFilters = {}): string {
  return `/api/admin/export${queryString({ ...filters }, { format })}`
}

/** Empty filters are omitted rather than sent as `&search=`. */
function queryString(filters: AdminFilters, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(extra)) params.set(key, value)
  if (filters.search?.trim()) params.set('search', filters.search.trim())
  if (filters.type) params.set('type', filters.type)
  if (filters.direction) params.set('direction', filters.direction)

  const query = params.toString()
  return query ? `?${query}` : ''
}
