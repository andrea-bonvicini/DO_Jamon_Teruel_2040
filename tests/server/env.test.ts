import { afterEach, describe, expect, it } from 'vitest'
import { InvalidEnvError, MissingEnvError, env } from '../../server/env'

/**
 * These exist because of a real outage: a Supabase URL with a path on the end
 * made every read AND every write fail with «Invalid path specified in
 * request URL» — a message that names neither the variable nor the file, and
 * that took a reproduction to trace. The parsing below turns the recoverable
 * mistakes into nothing and the rest into a sentence that says where to look.
 */
const original = process.env.SUPABASE_URL

afterEach(() => {
  if (original === undefined) delete process.env.SUPABASE_URL
  else process.env.SUPABASE_URL = original
})

describe('the Supabase project URL', () => {
  it('keeps a clean one exactly as it is', () => {
    process.env.SUPABASE_URL = 'https://abcdefgh.supabase.co'
    expect(env.supabaseUrl).toBe('https://abcdefgh.supabase.co')
  })

  it('absorbs a trailing slash, which is how a paste usually arrives', () => {
    process.env.SUPABASE_URL = 'https://abcdefgh.supabase.co/'
    expect(env.supabaseUrl).toBe('https://abcdefgh.supabase.co')
  })

  it('absorbs a pasted path, the mistake that actually took production down', () => {
    process.env.SUPABASE_URL = 'https://abcdefgh.supabase.co/rest/v1'
    expect(env.supabaseUrl).toBe('https://abcdefgh.supabase.co')
  })

  it('absorbs the whitespace a copy leaves behind', () => {
    process.env.SUPABASE_URL = '  https://abcdefgh.supabase.co \n'
    expect(env.supabaseUrl).toBe('https://abcdefgh.supabase.co')
  })

  it('says so when the database connection string was pasted instead', () => {
    // Supabase shows both on the same settings page, next to each other.
    process.env.SUPABASE_URL = 'postgresql://postgres:secret@db.abcdefgh.supabase.co:5432/postgres'
    expect(() => env.supabaseUrl).toThrow(InvalidEnvError)
    expect(() => env.supabaseUrl).toThrow(/not the database connection string/)
  })

  it('says so when it is not a URL at all', () => {
    process.env.SUPABASE_URL = 'abcdefgh.supabase.co'
    expect(() => env.supabaseUrl).toThrow(/Project Settings/)
  })

  it('still complains loudly when it is missing', () => {
    delete process.env.SUPABASE_URL
    expect(() => env.supabaseUrl).toThrow(MissingEnvError)
  })

  it('never leaks the whole value into the message', () => {
    process.env.SUPABASE_URL = 'no-es-una-url-pero-es-larguisima-y-secreta-1234567890'
    try {
      void env.supabaseUrl
      throw new Error('debería haber fallado')
    } catch (caught) {
      expect((caught as Error).message).not.toContain('1234567890')
    }
  })
})
