/**
 * The fieldwork round a response belongs to.
 *
 * Stamped server-side, never by the client: a wave is an operational fact
 * about the study, not something a respondent gets a say in.
 *
 * It is NOT `questionnaire_version`. The content changed mid-wave on
 * 2026-09-28, so the two move independently, and treating them as one would
 * break exactly the wave-over-wave comparison the codes exist to allow.
 */
export function currentWave(): string {
  return process.env.WAVE?.trim() || '2026-T4'
}
