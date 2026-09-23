import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..')
const API = join(ROOT, 'api')

interface Entry {
  path: string
  relative: string
  isDirectory: boolean
}

function listAll(dir: string): Entry[] {
  const entries: Entry[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const isDirectory = statSync(full).isDirectory()
    entries.push({ path: full, relative: relative(API, full).replace(/\\/g, '/'), isDirectory })
    if (isDirectory) entries.push(...listAll(full))
  }
  return entries
}

const ENTRIES = listAll(API)

describe('the api/ directory shape', () => {
  it('has the six routes the blueprint specifies', () => {
    const files = ENTRIES.filter((entry) => !entry.isDirectory)
      .map((entry) => entry.relative)
      .toSorted()

    expect(files).toEqual([
      'admin/export.ts',
      'admin/login.ts',
      'admin/logout.ts',
      'admin/response.ts',
      'admin/responses.ts',
      'responses.ts',
    ])
  })

  it('uses no [dynamic] path segments — ids travel in the query string', () => {
    for (const entry of ENTRIES) {
      expect(entry.relative, entry.relative).not.toMatch(/[[\]]/)
    }
  })

  it('never names a file like a sibling directory', () => {
    // api/admin/responses.ts next to api/admin/responses/ silently unpublishes
    // the function and the SPA rewrite returns HTML where JSON is expected.
    const directories = new Set(
      ENTRIES.filter((entry) => entry.isDirectory).map((entry) => entry.relative),
    )

    for (const entry of ENTRIES) {
      if (entry.isDirectory) continue
      const withoutExtension = entry.relative.replace(/\.ts$/, '')
      expect(
        directories.has(withoutExtension),
        `${entry.relative} collides with the directory ${withoutExtension}/`,
      ).toBe(false)
    }
  })

  it('contains only .ts files', () => {
    for (const entry of ENTRIES) {
      if (entry.isDirectory) continue
      expect(entry.relative.endsWith('.ts'), entry.relative).toBe(true)
    }
  })

  it('exports a default handler from every route', async () => {
    const files = ENTRIES.filter((entry) => !entry.isDirectory)
    for (const file of files) {
      const module = (await import(/* @vite-ignore */ file.path)) as { default?: unknown }
      expect(typeof module.default, file.relative).toBe('function')
    }
  })
})
