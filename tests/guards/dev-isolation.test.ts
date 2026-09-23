import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..')

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) files.push(...walk(full))
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full)
  }
  return files
}

const SHIPPED = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'api'))].map((path) => ({
  relative: relative(ROOT, path).split(sep).join('/'),
  text: readFileSync(path, 'utf8'),
}))

/**
 * `dev/` holds a throwaway in-memory backend for local walkthroughs. It must
 * never become load-bearing: production serves `api/` against Supabase.
 */
describe('the development backend stays out of the product', () => {
  it('finds the shipped sources', () => {
    expect(SHIPPED.length).toBeGreaterThan(20)
  })

  it('is imported by nothing in src/ or api/', () => {
    const offenders = SHIPPED.filter((file) => /from\s+['"][^'"]*\bdev\//.test(file.text)).map(
      (file) => file.relative,
    )

    expect(offenders).toEqual([])
  })

  it('only ever flows the other way: dev/ may use server/ and src/data/', () => {
    const devApi = readFileSync(join(ROOT, 'dev', 'api.ts'), 'utf8')
    expect(devApi).toMatch(/from '\.\.\/server\//)
    // It must not reach into the browser code.
    expect(devApi).not.toMatch(/from '\.\.\/src\/(components|screens|admin|network)\//)
  })

  it('is kept out of the production build by apply: serve', () => {
    const config = readFileSync(join(ROOT, 'vite.config.mts'), 'utf8')
    expect(config).toMatch(/apply:\s*'serve'/)
  })
})
