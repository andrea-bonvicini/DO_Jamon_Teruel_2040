import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { QUESTIONNAIRES } from '../../src/data/questionnaires'
import type { Questionnaire } from '../../src/data/types'

/**
 * Checks the transcription against the source documents, so nobody can
 * silently reword a question in the code without also updating the source
 * (or deliberately deciding to diverge).
 *
 * The .docx files hold the authoritative wording. This reads their XML
 * directly — no dependency, no conversion step — and asserts that every
 * question text, option text and grid-row text in `src/data/questionnaires/`
 * appears verbatim in the matching document.
 *
 * If the study owner rewords a question, update the .docx AND the .ts file,
 * and bump the questionnaire `version`.
 */
const SOURCES: Record<keyof typeof QUESTIONNAIRES, string> = {
  individual: '2_Encuesta_Usuario_Final_DO_Jamon_Teruel.docx',
  company: '3_Encuesta_Empresas_DO_Jamon_Teruel.docx',
}

const ROOT = join(__dirname, '..', '..')

/**
 * The one place the code adds wording the source does not contain.
 *
 * Consumer Q3 says "Comunidad autónoma de residencia (texto libre /
 * desplegable)" and lists no options. The project owner chose the dropdown,
 * so the 19 comunidades y ciudades autónomas are supplied by the code. Their
 * names are the official ones, not study content.
 */
const SUPPLIED_BY_THE_CODE = /^I-Q03\//

/** Extracts the visible text of a .docx without unzipping to disk. */
function docxText(filename: string): string | null {
  const path = join(ROOT, filename)
  if (!existsSync(path)) return null

  const buffer = readFileSync(path)
  // `word/document.xml` is stored deflated; Node can inflate it directly.
  const xml = inflateEntry(buffer, 'word/document.xml')
  if (!xml) return null

  return normalise(
    xml
      .replace(/<w:tab\/>/g, ' ')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'"),
  )
}

/** Minimal ZIP reader: finds one entry's local header and inflates it. */
function inflateEntry(zip: Buffer, name: string): string | null {
  const { inflateRawSync } = require('node:zlib') as typeof import('node:zlib')
  const target = Buffer.from(name, 'utf8')

  for (let i = 0; i + 30 < zip.length; i += 1) {
    if (zip.readUInt32LE(i) !== 0x0403_4b50) continue

    const nameLength = zip.readUInt16LE(i + 26)
    const extraLength = zip.readUInt16LE(i + 28)
    const entryName = zip.subarray(i + 30, i + 30 + nameLength)
    if (!entryName.equals(target)) continue

    const method = zip.readUInt16LE(i + 8)
    const compressedSize = zip.readUInt32LE(i + 18)
    const start = i + 30 + nameLength + extraLength

    // Streamed entries put the sizes in a trailing descriptor; fall back to
    // inflating everything from `start` and letting zlib stop at the end.
    const data = compressedSize > 0 ? zip.subarray(start, start + compressedSize) : zip.subarray(start)
    return method === 0 ? data.toString('utf8') : inflateRawSync(data).toString('utf8')
  }

  return null
}

function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

function stringsOf(questionnaire: Questionnaire): Array<{ where: string; text: string }> {
  const strings: Array<{ where: string; text: string }> = []

  for (const question of questionnaire.questions) {
    strings.push({ where: question.id, text: question.text })
    if (question.type === 'single_choice' || question.type === 'multi_choice') {
      for (const option of question.options) {
        strings.push({ where: `${question.id}/${option.id}`, text: option.text })
      }
    }
    if (question.type === 'scale_grid') {
      for (const row of question.rows) {
        strings.push({ where: `${question.id}/${row.id}`, text: row.text })
      }
    }
  }

  if (questionnaire.openQuestion) {
    strings.push({ where: 'openQuestion', text: questionnaire.openQuestion.text })
  }

  return strings
}

describe.each(Object.entries(SOURCES))('%s is transcribed from its source document', (audience, filename) => {
  const source = docxText(filename)
  const questionnaire = QUESTIONNAIRES[audience as keyof typeof QUESTIONNAIRES]

  it('can read the source document', () => {
    expect(source, `${filename} must stay in the repository root`).not.toBeNull()
    expect(source!.length).toBeGreaterThan(1000)
  })

  it('uses only wording that appears in the source', () => {
    const mismatches = stringsOf(questionnaire)
      .filter((entry) => !SUPPLIED_BY_THE_CODE.test(entry.where))
      .filter((entry) => !source!.includes(normalise(entry.text)))
      .map((entry) => `${entry.where}: ${entry.text}`)

    expect(mismatches).toEqual([])
  })
})
