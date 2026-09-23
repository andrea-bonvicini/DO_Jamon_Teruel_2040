/**
 * Required server-side environment variables, read once.
 *
 * None of these are prefixed `VITE_`. A `VITE_` prefix would bundle the value
 * into the browser build, which for the Supabase service-role key would be a
 * full database compromise.
 *
 * Each getter throws a named error if its variable is missing, so a
 * misconfigured deploy fails loudly on the first request instead of quietly
 * returning empty lists.
 */
export class MissingEnvError extends Error {
  constructor(name: string) {
    super(`Missing required environment variable: ${name}`)
    this.name = 'MissingEnvError'
  }
}

function required(name: string): string {
  const value = process.env[name]
  if (!value || value.trim() === '') throw new MissingEnvError(name)
  return value
}

export const env = {
  get supabaseUrl(): string {
    return required('SUPABASE_URL')
  },
  get supabaseServiceRoleKey(): string {
    return required('SUPABASE_SERVICE_ROLE_KEY')
  },
  get adminPasswordHash(): string {
    return required('ADMIN_PASSWORD_HASH')
  },
  get adminSessionSecret(): string {
    return required('ADMIN_SESSION_SECRET')
  },
}
