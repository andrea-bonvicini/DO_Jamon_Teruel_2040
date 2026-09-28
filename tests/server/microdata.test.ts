import { describe, expect, it } from 'vitest'
import { buildMicrodataCsv, buildOpenTextCsv } from '../../server/microdata'
import { buildFrequencyCsv, collinearSegments } from '../../server/exports'
import { buildSpine } from '../../server/exportModel'
import { EXCEL_ES, MACHINE, UTF8_BOM, toCsv } from '../../server/csv'
import { MISSING, NOT_SHOWN } from '../../src/data/codes'
import type { ResponseRow } from '../../server/responsesRepository'
import { buildSnapshot } from '../../src/data/snapshot'
import { QUESTIONNAIRES } from '../../src/data/questionnaires'
import type { Answers, AudienceId } from '../../src/data/types'

/** RFC 4180 reader, parameterised by separator so both profiles can be read. */
function parse(csv: string, separator: string): string[][] {
  const body = csv.startsWith(UTF8_BOM) ? csv.slice(UTF8_BOM.length) : csv
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < body.length; i += 1) {
    const char = body[i]!
    if (quoted) {
      if (char === '"') {
        if (body[i + 1] === '"') {
          field += '"'
          i += 1
        } else quoted = false
      } else field += char
      continue
    }
    if (char === '"') quoted = true
    else if (char === separator) {
      row.push(field)
      field = ''
    } else if (char === '\r' && body[i + 1] === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i += 1
    } else field += char
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

const micro = (rows: ResponseRow[]) => parse(buildMicrodataCsv(rows), ',')
const cell = (table: string[][], line: number, code: string) =>
  table[line]![table[0]!.indexOf(code)]

function makeRow(id: string, answers: Answers, extra: Partial<ResponseRow> = {}): ResponseRow {
  const audience: AudienceId = extra.respondent_type ?? 'company'
  return {
    id,
    created_at: '2026-10-01T10:00:00.000Z',
    respondent_type: audience,
    identification: { companyName: `Empresa ${id}` },
    questionnaire_id: audience,
    questionnaire_version: QUESTIONNAIRES[audience].version,
    answers,
    questionnaire: buildSnapshot(QUESTIONNAIRES[audience], answers, '2026-10-01T10:00:00.000Z'),
    open_answer: null,
    wave: '2026-T4',
    ...extra,
  }
}

const COMPANY: Answers = {
  'C-Q01': { kind: 'option', optionId: 'matadero' },
  'C-Q02': { kind: 'option', optionId: '6-20' },
  'C-Q03': { kind: 'option', optionId: '10-25' },
  'C-Q04': { kind: 'option', optionId: '25-50' },
  'C-Q05': { kind: 'options', optionIds: ['local', 'exportacion'] },
  'C-Q06': { kind: 'option', optionId: 'crecido' },
  'C-Q07': { kind: 'option', optionId: 'mantendra' },
  'C-Q08': { kind: 'options', optionIds: ['precio'] },
  'C-Q09': { kind: 'option', optionId: 'buena' },
  'C-Q10': { kind: 'option', optionId: 'si-clara' },
  'C-Q11': { kind: 'option', optionId: 'si' },
  'C-Q12': { kind: 'option', optionId: 'si' },
  'C-Q13': { kind: 'options', optionIds: ['bienestar'] },
  'C-Q14': { kind: 'option', optionId: 'si' },
  'C-Q15': {
    kind: 'scaleRows',
    values: { 'aporta-valor': 4, controles: 3, 'ayuda-vender': 5, defiende: 2, comunicacion: 1 },
  },
  'C-Q16': { kind: 'options', optionIds: ['clima'] },
  'C-Q17': { kind: 'options', optionIds: ['exportacion'] },
}

describe('the microdata', () => {
  it('writes one line per respondent, in the machine profile', () => {
    const csv = buildMicrodataCsv([makeRow('r1', COMPANY), makeRow('r2', COMPANY)])

    expect(csv.startsWith(UTF8_BOM)).toBe(false) // a BOM breaks half the readers
    expect(parse(csv, ',')).toHaveLength(3)
    expect(parse(csv, ',')[0]).toContain('respondent_id')
  })

  it('carries no identification, only an opaque id', () => {
    // The company name identifies the respondent by definition, and this is
    // the file that leaves the building.
    const csv = buildMicrodataCsv([makeRow('r1', COMPANY)])
    expect(csv).not.toContain('Empresa r1')
    expect(csv).toContain('r1')
  })

  it('explodes a multi-choice question into a binary column per option', () => {
    const table = micro([makeRow('r1', COMPANY)])

    expect(cell(table, 1, 'C-Q05.local')).toBe('1')
    expect(cell(table, 1, 'C-Q05.exportacion')).toBe('1')
    expect(cell(table, 1, 'C-Q05.aragon')).toBe('0')
    expect(cell(table, 1, 'C-Q05.n_selected')).toBe('2')
  })

  it('stores the option code for a single choice, not its Spanish label', () => {
    const table = micro([makeRow('r1', COMPANY)])
    expect(cell(table, 1, 'C-Q01')).toBe('matadero')
  })

  it('gives every grid item its own numeric column', () => {
    const table = micro([makeRow('r1', COMPANY)])
    expect(cell(table, 1, 'C-Q15.aporta-valor')).toBe('4')
    expect(cell(table, 1, 'C-Q15.comunicacion')).toBe('1')
  })

  it('tells "never shown" apart from "asked and unanswered"', () => {
    // The whole reason for the sentinels: as blanks these two are one fact.
    const withOtros: Answers = { ...COMPANY, 'C-Q08': { kind: 'options', optionIds: ['otros'] } }
    const table = micro([makeRow('r1', COMPANY), makeRow('r2', withOtros)])

    // r1 never ticked «Otros», so the follow-up was never put in front of them.
    expect(cell(table, 1, 'C-Q08b')).toBe(String(NOT_SHOWN))
    // r2 did, was asked, and left it blank.
    expect(cell(table, 2, 'C-Q08b')).toBe('0')
    // And an optional question everybody sees but nobody answered is missing.
    expect(cell(table, 1, 'C-Q12b')).toBe('0')
  })

  it('marks an option a later version added as never shown, not as a no', () => {
    const consumes: Answers = { 'I-Q06': { kind: 'option', optionId: 'semanal' } }
    const never: Answers = { 'I-Q06': { kind: 'option', optionId: 'nunca' } }
    const table = micro([
      makeRow('r1', never, { respondent_type: 'individual', questionnaire_id: 'individual' }),
      makeRow('r2', consumes, { respondent_type: 'individual', questionnaire_id: 'individual' }),
    ])

    // r1 said «Nunca», so the fourteen gated questions were never shown.
    expect(cell(table, 1, 'I-Q08.supermercado')).toBe(String(NOT_SHOWN))
    // r2 was shown them and answered none, which is a different fact.
    expect(cell(table, 2, 'I-Q08.supermercado')).toBe(String(MISSING))
  })

  it('writes decimals with a point, the way a machine reads them', () => {
    const answers: Answers = {
      'I-Q06': { kind: 'option', optionId: 'semanal' },
      'I-Q10': { kind: 'number', value: 18.5 },
    }
    const table = micro([
      makeRow('r1', answers, { respondent_type: 'individual', questionnaire_id: 'individual' }),
    ])
    expect(cell(table, 1, 'I-Q10')).toBe('18.5')
  })

  it('keeps the verbatims in their own long file, keyed by respondent and code', () => {
    const answers: Answers = { ...COMPANY, 'C-Q12b': { kind: 'text', value: 'No hay relevo' } }
    const table = parse(buildOpenTextCsv([makeRow('r1', answers, { open_answer: 'Más promoción' })]), ',')

    expect(table[0]).toEqual(['respondent_id', 'question_code', 'text'])
    expect(table.slice(1)).toContainEqual(['r1', 'C-Q12b', 'No hay relevo'])
    expect(table.slice(1)).toContainEqual(['r1', 'open_answer', 'Más promoción'])
  })

  it('exports valid, empty-but-well-formed files with no responses', () => {
    expect(micro([])).toHaveLength(1)
    expect(parse(buildOpenTextCsv([]), ',')).toHaveLength(1)
  })
})

describe('the round trip', () => {
  it('reproduces the frequency counts exactly by aggregating the microdata', () => {
    // The guarantee that the two files describe one reality. If the
    // aggregation ever drifts from the microdata, it fails here.
    const pool = [
      makeRow('r1', COMPANY),
      makeRow('r2', { ...COMPANY, 'C-Q01': { kind: 'option', optionId: 'secadero' } }),
      makeRow('r3', { ...COMPANY, 'C-Q05': { kind: 'options', optionIds: ['aragon'] } }),
    ]

    const table = micro(pool)
    const headers = table[0]!
    const body = table.slice(1)

    const frequency = parse(buildFrequencyCsv(pool), ';')
    const fh = frequency[0]!
    const totals = frequency
      .slice(1)
      .filter((line) => line[fh.indexOf('Segmento')] === '(total)')

    let compared = 0
    for (const [index, code] of headers.entries()) {
      // Every binary option column must equal its count in the frequency file.
      if (!code.includes('.') || code.endsWith('.n_selected')) continue
      const [questionId, optionId] = code.split('.')
      const question = QUESTIONNAIRES.company.questions.find((q) => q.id === questionId)
      if (!question || question.type !== 'multi_choice') continue

      const fromMicrodata = body.filter((line) => line[index] === '1').length
      const optionText = question.options.find((o) => o.id === optionId)!.text
      const line = totals.find(
        (entry) => entry[fh.indexOf('Código')] === questionId && entry[fh.indexOf('Opción')] === optionText,
      )!

      expect(Number(line[fh.indexOf('Respuestas')]), code).toBe(fromMicrodata)
      compared += 1
    }

    expect(compared).toBeGreaterThan(20)
  })
})

describe('the two locale profiles', () => {
  it('keeps a decimal comma a bare field in the Excel profile', () => {
    // 2026-09-24: `18.5` was read as TEXT by Excel in Spanish and the four
    // price questions stopped being averageable. A comma must NOT be quoted
    // here, because `;` is the separator — that is what makes it a number.
    const csv = toCsv(['precio'], [['18,5']], EXCEL_ES)
    expect(csv).toContain(UTF8_BOM)
    expect(csv).toContain('precio\r\n18,5\r\n')
    expect(csv).not.toContain('"18,5"')
  })

  it('quotes that same comma in the machine profile, where it separates fields', () => {
    const csv = toCsv(['a', 'b'], [['18,5', 'x']], MACHINE)
    expect(csv.startsWith(UTF8_BOM)).toBe(false)
    expect(csv).toContain('"18,5",x')
  })

  it('never lets the two profiles be quietly unified', () => {
    expect(EXCEL_ES.separator).not.toBe(MACHINE.separator)
    expect(EXCEL_ES.decimal).not.toBe(MACHINE.decimal)
    expect(EXCEL_ES.bom).not.toBe(MACHINE.bom)
  })
})

describe('the collinearity detector', () => {
  it('fires when two cuts split the sample the same way', () => {
    // Three respondents: activity type and headcount both split them 2-vs-1,
    // identically. One of the two tells you nothing the other did not.
    const pool = [
      makeRow('r1', { ...COMPANY }),
      makeRow('r2', { ...COMPANY }),
      makeRow('r3', {
        ...COMPANY,
        'C-Q01': { kind: 'option', optionId: 'secadero' },
        'C-Q02': { kind: 'option', optionId: '1-5' },
      }),
    ]

    const warnings = collinearSegments(pool, buildSpine(pool))
    expect(warnings.get('C-Q02')).toContain('Tipo de actividad')

    // And it reaches the file, where somebody will actually see it.
    const frequency = parse(buildFrequencyCsv(pool), ';')
    const aviso = frequency[0]!.indexOf('Aviso')
    expect(frequency.slice(1).some((line) => line[aviso] !== '')).toBe(true)
  })

  it('stays quiet when the cuts are genuinely different', () => {
    const pool = [
      makeRow('r1', { ...COMPANY }),
      makeRow('r2', { ...COMPANY, 'C-Q01': { kind: 'option', optionId: 'secadero' } }),
      makeRow('r3', { ...COMPANY, 'C-Q02': { kind: 'option', optionId: '1-5' } }),
    ]
    expect(collinearSegments(pool, buildSpine(pool)).size).toBe(0)
  })
})
