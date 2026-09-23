import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..')
const SRC = join(ROOT, 'src')

function walk(dir: string, extensions = ['.ts', '.tsx']): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) files.push(...walk(full, extensions))
    else if (extensions.some((ext) => entry.endsWith(ext))) files.push(full)
  }
  return files
}

const SOURCES = walk(SRC).map((path) => ({
  path,
  relative: relative(ROOT, path).replace(/\\/g, '/'),
  text: readFileSync(path, 'utf8'),
}))

describe('the network rule', () => {
  it('finds source files to check', () => {
    expect(SOURCES.length).toBeGreaterThan(20)
  })

  it('calls fetch only from src/network/', () => {
    const offenders = SOURCES.filter(
      (file) => /\bfetch\s*\(/.test(file.text) && !file.relative.startsWith('src/network/'),
    ).map((file) => file.relative)

    expect(offenders).toEqual([])
  })

  it('targets only /api/ URLs', () => {
    const targets: string[] = []
    for (const file of SOURCES) {
      for (const match of file.text.matchAll(/fetch\s*\(\s*(['"`])([^'"`]*)\1/g)) {
        targets.push(match[2] ?? '')
      }
      // Template-built URLs, e.g. `/api/admin/response?id=${id}`.
      for (const match of file.text.matchAll(/return request<[^>]*>\(\s*`([^`]*)`/g)) {
        targets.push(match[1] ?? '')
      }
    }

    expect(targets.length).toBeGreaterThan(0)
    for (const target of targets) {
      expect(target.startsWith('/api/'), `fetch target "${target}" must start with /api/`).toBe(true)
    }
  })

  it('never uses XMLHttpRequest, WebSocket, EventSource or axios', () => {
    for (const file of SOURCES) {
      expect(file.text, file.relative).not.toMatch(/\bXMLHttpRequest\b/)
      expect(file.text, file.relative).not.toMatch(/\bnew WebSocket\b/)
      expect(file.text, file.relative).not.toMatch(/\bnew EventSource\b/)
      expect(file.text, file.relative).not.toMatch(/from ['"]axios['"]/)
    }
  })

  it('never hard-codes an absolute http(s) URL in src/, except the QR poster target', () => {
    const allowed = new Set(['src/data/publicUrl.ts'])
    for (const file of SOURCES) {
      if (allowed.has(file.relative)) continue
      const matches = [...file.text.matchAll(/https?:\/\/[^\s'"`)]+/g)].map((m) => m[0])
      // Namespace URIs in SVG markup are not network requests.
      const remote = matches.filter((url) => !url.startsWith('http://www.w3.org/'))
      expect(remote, file.relative).toEqual([])
    }
  })

  it('keeps index.html free of external URLs', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8')
    expect(html).not.toMatch(/https?:\/\//)
    expect(html).not.toMatch(/fonts\.googleapis|cdn\./)
  })

  it('declares no analytics, tracking or error-reporting SDK', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const names = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ]

    const forbidden =
      /(sentry|analytics|posthog|mixpanel|amplitude|segment|hotjar|fullstory|logrocket|datadog|gtag|google-analytics|axios)/i

    expect(names.filter((name) => forbidden.test(name))).toEqual([])
  })

  it('loads fonts from @fontsource, never from a remote stylesheet', () => {
    const fonts = readFileSync(join(SRC, 'design', 'fonts.ts'), 'utf8')
    expect(fonts).toMatch(/@fontsource/)
    expect(fonts).not.toMatch(/https?:\/\//)
  })
})

describe('the no-stored-drafts rule', () => {
  // Blueprint §6.2: in-progress answers must not survive a refresh, so a
  // shared tablet at an event cannot leak one respondent's draft into the
  // next session. Nothing in the app stores anything in the browser.
  it('never touches browser storage', () => {
    const offenders = SOURCES.filter((file) =>
      /\b(localStorage|sessionStorage|indexedDB)\b/.test(file.text),
    ).map((file) => file.relative)

    expect(offenders).toEqual([])
  })

  it('never reaches for a cookie either', () => {
    const offenders = SOURCES.filter((file) => /\bdocument\.cookie\b/.test(file.text)).map(
      (file) => file.relative,
    )

    expect(offenders).toEqual([])
  })
})

describe('the data/UI separation rule', () => {
  it('keeps src/data/ free of JSX and of component imports', () => {
    const dataFiles = SOURCES.filter((file) => file.relative.startsWith('src/data/'))
    expect(dataFiles.length).toBeGreaterThan(5)

    for (const file of dataFiles) {
      expect(file.relative.endsWith('.tsx'), `${file.relative} must not be a .tsx file`).toBe(false)
      expect(file.text, file.relative).not.toMatch(/from ['"].*\/components\//)
      expect(file.text, file.relative).not.toMatch(/from ['"]react['"]/)
    }
  })
})
