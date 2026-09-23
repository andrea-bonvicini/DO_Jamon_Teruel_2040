import type { QuestionnaireSnapshot } from '../data/snapshot'
import type { Answers, AudienceId } from '../data/types'

export interface SubmissionPayload {
  audience: AudienceId
  questionnaireId: AudienceId
  questionnaireVersion: string
  identification: Record<string, string | number>
  /** Answers to CURRENTLY VISIBLE questions only. */
  answers: Answers
  openAnswer: string | null
  snapshot: QuestionnaireSnapshot
}

/**
 * `src/network/` is the only directory in `src/` allowed to call fetch, and
 * every URL it targets starts with `/api/`. Enforced by
 * tests/guards/no-network.test.ts.
 */
export async function submitResponse(payload: SubmissionPayload): Promise<void> {
  const response = await fetch('/api/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Submission failed (${response.status}).`)
  }
}
