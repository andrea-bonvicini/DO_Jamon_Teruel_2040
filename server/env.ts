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

export class InvalidEnvError extends Error {
  constructor(name: string, reason: string) {
    super(`${name} is not usable: ${reason}`)
    this.name = 'InvalidEnvError'
  }
}

function required(name: string): string {
  const value = process.env[name]
  if (!value || value.trim() === '') throw new MissingEnvError(name)
  return value.trim()
}

/**
 * The Supabase project origin, and nothing else.
 *
 * `supabase-js` appends `/rest/v1/...` to whatever it is given, so a trailing
 * slash or a pasted path turns every single call — read and write — into
 * «Invalid path specified in request URL», an error that says nothing about
 * where to look. Taking the origin absorbs both mistakes; anything that is
 * not an https URL is a different variable pasted by accident, and says so.
 */
function projectUrl(name: string): string {
  const value = required(name)

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new InvalidEnvError(name, `«${value.slice(0, 24)}…» is not a URL. Copy Project URL from Supabase → Project Settings → API.`)
  }

  if (parsed.protocol !== 'https:') {
    throw new InvalidEnvError(
      name,
      `it starts with "${parsed.protocol}", not "https:". This is the Project URL, not the database connection string.`,
    )
  }

  return parsed.origin
}

export const env = {
  get supabaseUrl(): string {
    return projectUrl('SUPABASE_URL')
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
