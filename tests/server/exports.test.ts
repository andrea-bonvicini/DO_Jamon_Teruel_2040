import { describe, expect, it } from 'vitest'
import {
  buildCodebookCsv,
  buildFrequencyCsv,
  buildMatrixCsv,
  exportFilename,
} from '../../server/exports'
import type { ResponseRow } from '../../server/responsesRepository'
import { buildSnapshot } from '../../src/data/snapshot'
import type { QuestionnaireSnapshot, SnapshotQuestion } from '../../src/data/snapshot'
import { QUESTIONNAIRES } from '../../src/data/questionnaires'
import type { Answers, AudienceId } from '../../src/data/types'
import { UTF8_BOM } from '../../server/csv'

/**
 * A real CSV reader, not `split(';')`: headers now carry human text, and a
 * naive split would quietly shift every column the moment one is quoted.
 */
function parse(csv: string): string[][] {
  const body = csv.slice(UTF8_BOM.length)
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
    else if (char === ';') {
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

const cell = (rows: string[][], line: number, header: string): string =>
  rows[line]![rows[0]!.indexOf(header)] ?? ''

/** Every line of the frequency file whose question and option match. */
function find(rows: string[][], question: string, option: string): string[] | undefined {
  const headers = rows[0]!
  const q = headers.indexOf('Pregunta')
  const o = headers.indexOf('Opción')
  return rows.slice(1).find((line) => line[q] === question && line[o] === option)
}

const column = (rows: string[][], line: string[], header: string): string =>
  line[rows[0]!.indexOf(header)] ?? ''

// ─── Synthetic snapshots, so versions and options can be moved at will ──────

function makeQuestion(partial: Partial<SnapshotQuestion> & Pick<SnapshotQuestion, 'id' | 'type'>): SnapshotQuestion {
  return {
    label: partial.id,
    text: partial.id,
    sectionId: 'bloque',
    sectionName: 'Bloque',
    ...partial,
  }
}

function snapshot(
  version: string,
  capturedAt: string,
  questions: SnapshotQuestion[],
  extra: Partial<QuestionnaireSnapshot> = {},
): QuestionnaireSnapshot {
  return { questionnaireId: 'company', version, capturedAt, questions, ...extra }
}

function makeRow(
  id: string,
  snap: QuestionnaireSnapshot,
  answers: Answers,
  overrides: Partial<ResponseRow> = {},
): ResponseRow {
  return {
    id,
    created_at: snap.capturedAt,
    respondent_type: (snap.questionnaireId ?? 'company') as AudienceId,
    identification: {},
    questionnaire_id: snap.questionnaireId,
    questionnaire_version: snap.version,
    answers,
    questionnaire: snap,
    open_answer: null,
    ...overrides,
  }
}

const COLOUR = (options: Array<[string, string]>) =>
  makeQuestion({
    id: 'Q1',
    type: 'multi_choice',
    label: 'Color',
    text: '¿Qué colores?',
    options: options.map(([optionId, text]) => ({ id: optionId, text })),
  })

// ─── The matrix ─────────────────────────────────────────────────────────────

describe('the matrix', () => {
  const answers: Answers = {
    'C-Q01': { kind: 'option', optionId: 'secadero' },
    'C-Q05': { kind: 'options', optionIds: ['local', 'exportacion'] },
    'C-Q15': { kind: 'scaleRows', values: { 'aporta-valor': 5, controles: 2 } },
  }

  const company = (overrides: Partial<ResponseRow> = {}): ResponseRow => ({
    id: 'r1',
    created_at: '2026-03-04T09:05:00.000Z',
    respondent_type: 'company',
    identification: { companyName: 'Secaderos del Bajo Aragón' },
    questionnaire_id: 'company',
    questionnaire_version: QUESTIONNAIRES.company.version,
    answers,
    questionnaire: buildSnapshot(QUESTIONNAIRES.company, answers, '2026-03-04T09:05:00.000Z'),
    open_answer: null,
    ...overrides,
  })

  it('writes one line per respondent', () => {
    expect(parse(buildMatrixCsv([company(), company({ id: 'r2' })]))).toHaveLength(3)
  })

  it('heads the columns with the question, not its identifier', () => {
    const rows = parse(buildMatrixCsv([company()]))
    // This is the whole complaint the rework answers: `C-Q01` told nobody
    // what was asked.
    expect(rows[0]).not.toContain('C-Q01')
    expect(rows[0]).toContain('Tipo de actividad')
    expect(cell(rows, 1, 'Tipo de actividad')).toBe('Secadero / industria elaboradora')
  })

  it('leads with the company name under its own label', () => {
    const rows = parse(buildMatrixCsv([company()]))
    expect(rows[0]![0]).toBe('Nombre de la empresa')
    expect(rows[1]![0]).toBe('Secaderos del Bajo Aragón')
  })

  it('gives every option of a multi-choice question its own Sí/No column', () => {
    const rows = parse(buildMatrixCsv([company()]))
    expect(cell(rows, 1, 'Mercados — Local/provincial')).toBe('Sí')
    expect(cell(rows, 1, 'Mercados — Exportación')).toBe('Sí')
    expect(cell(rows, 1, 'Mercados — Resto de España')).toBe('No')
  })

  it('gives every grid row its own column', () => {
    const rows = parse(buildMatrixCsv([company()]))
    expect(cell(rows, 1, 'Valoración de la D.O. — La D.O. aporta valor a mi negocio')).toBe('5')
  })

  it('keeps the technical identifiers, but out of the way at the end', () => {
    const rows = parse(buildMatrixCsv([company()]))
    expect(rows[0]!.slice(-5)).toEqual([
      'Fecha ISO',
      'Público',
      'Versión',
      'Identificador',
      'Sin resolver',
    ])
    expect(cell(rows, 1, 'Identificador')).toBe('r1')
    expect(cell(rows, 1, 'Fecha ISO')).toBe('2026-03-04T09:05:00.000Z')
  })

  it('is byte-for-byte identical whatever order the rows arrive in', () => {
    // The old column order was "first seen in `rows`", and `rows` is sorted
    // by a direction taken from the query string: the same data produced two
    // different files for `?direction=asc` and `?direction=desc`.
    const v1 = snapshot('v1', '2026-01-01T00:00:00.000Z', [COLOUR([['a', 'Azul']])])
    const v2 = snapshot('v2', '2026-02-01T00:00:00.000Z', [
      COLOUR([
        ['a', 'Azul'],
        ['b', 'Blanco'],
      ]),
    ])
    const pool = [
      makeRow('r1', v1, { Q1: { kind: 'options', optionIds: ['a'] } }),
      makeRow('r2', v2, { Q1: { kind: 'options', optionIds: ['b'] } }),
    ]

    // The LINE order is allowed to follow the query — that is the «Sentido»
    // the admin chose. What must not follow it is the COLUMN order, which is
    // what the old "first seen in `rows`" rule made depend on it.
    expect(parse(buildMatrixCsv(pool))[0]).toEqual(parse(buildMatrixCsv(pool.toReversed()))[0])
    // The frequency file has no per-respondent lines at all, so the whole
    // file has to come out identical.
    expect(buildFrequencyCsv(pool)).toBe(buildFrequencyCsv(pool.toReversed()))
  })

  it('leaves a blank, not a No, where the question was never asked', () => {
    // 15 consumer questions hang off one condition. Writing `No` for someone
    // who never saw the question invents an answer for half the sample.
    const never: Answers = { 'I-Q06': { kind: 'option', optionId: 'nunca' } }
    const eats: Answers = {
      'I-Q06': { kind: 'option', optionId: 'semanal' },
      'I-Q08': { kind: 'options', optionIds: ['supermercado'] },
    }
    const rows = parse(
      buildMatrixCsv([
        makeRow('r1', buildSnapshot(QUESTIONNAIRES.individual, never, '2026-01-01T00:00:00.000Z'), never, {
          respondent_type: 'individual',
          questionnaire_id: 'individual',
        }),
        makeRow('r2', buildSnapshot(QUESTIONNAIRES.individual, eats, '2026-01-02T00:00:00.000Z'), eats, {
          respondent_type: 'individual',
          questionnaire_id: 'individual',
        }),
      ]),
    )

    const header = rows[0]!.find((h) => h.startsWith('Canal de compra — '))!
    expect(header).toBeDefined()
    expect(cell(rows, 1, header)).toBe('') // never asked
    expect(cell(rows, 2, header)).not.toBe('') // asked: Sí or No
  })

  it('keeps one column when a question was only reworded', () => {
    const v1 = snapshot('v1', '2026-01-01T00:00:00.000Z', [
      makeQuestion({ id: 'Q1', type: 'short_text', label: 'Antiguo' }),
    ])
    const v2 = snapshot('v2', '2026-02-01T00:00:00.000Z', [
      makeQuestion({ id: 'Q1', type: 'short_text', label: 'Nuevo' }),
    ])
    const rows = parse(
      buildMatrixCsv([
        makeRow('r1', v1, { Q1: { kind: 'text', value: 'uno' } }),
        makeRow('r2', v2, { Q1: { kind: 'text', value: 'dos' } }),
      ]),
    )

    expect(rows[0]!.filter((h) => h === 'Nuevo' || h === 'Antiguo')).toEqual(['Nuevo'])
    expect(cell(rows, 1, 'Nuevo')).toBe('uno')
    expect(cell(rows, 2, 'Nuevo')).toBe('dos')
  })

  it('splits a number question when its unit changed', () => {
    // €/kg and €/pieza are not the same variable; one column would average
    // them together and produce a number that means nothing.
    const kg = snapshot('v1', '2026-01-01T00:00:00.000Z', [
      makeQuestion({ id: 'Q1', type: 'number', label: 'Precio', unit: '€/kg' }),
    ])
    const pieza = snapshot('v2', '2026-02-01T00:00:00.000Z', [
      makeQuestion({ id: 'Q1', type: 'number', label: 'Precio', unit: '€/pieza' }),
    ])
    const rows = parse(
      buildMatrixCsv([
        makeRow('r1', kg, { Q1: { kind: 'number', value: 18 } }),
        makeRow('r2', pieza, { Q1: { kind: 'number', value: 120 } }),
      ]),
    )

    expect(rows[0]).toContain('Precio (€/kg)')
    expect(rows[0]).toContain('Precio (€/pieza)')
    expect(cell(rows, 1, 'Precio (€/kg)')).toBe('18')
    expect(cell(rows, 1, 'Precio (€/pieza)')).toBe('')
  })

  it('writes decimals with a comma, so Excel reads them as numbers', () => {
    const snap = snapshot('v1', '2026-01-01T00:00:00.000Z', [
      makeQuestion({ id: 'Q1', type: 'number', label: 'Precio', unit: '€/kg' }),
    ])
    const rows = parse(buildMatrixCsv([makeRow('r1', snap, { Q1: { kind: 'number', value: 18.5 } })]))
    expect(cell(rows, 1, 'Precio (€/kg)')).toBe('18,5')
  })

  it('keeps an answer no snapshot explains, in a column of its own', () => {
    const answersWithOrphan: Answers = { ...answers, 'C-Q99': { kind: 'text', value: 'huérfana' } }
    const rows = parse(buildMatrixCsv([company({ answers: answersWithOrphan })]))

    expect(cell(rows, 1, 'C-Q99')).toBe('huérfana')
    expect(cell(rows, 1, 'Sin resolver')).toBe('Sí')
  })

  it('flags a renamed option instead of losing it', () => {
    const renamed: Answers = { ...answers, 'C-Q01': { kind: 'option', optionId: 'ya-no-existe' } }
    const rows = parse(buildMatrixCsv([company({ answers: renamed })]))

    expect(cell(rows, 1, 'Tipo de actividad')).toBe('ya-no-existe')
    expect(cell(rows, 1, 'Sin resolver')).toBe('Sí')
  })

  it('leaves the flag empty when everything resolved', () => {
    expect(cell(parse(buildMatrixCsv([company()])), 1, 'Sin resolver')).toBe('')
  })

  it('omits the open-answer column when nobody was asked one', () => {
    const snap = snapshot('v1', '2026-01-01T00:00:00.000Z', [
      makeQuestion({ id: 'Q1', type: 'short_text', label: 'Algo' }),
    ])
    const rows = parse(buildMatrixCsv([makeRow('r1', snap, { Q1: { kind: 'text', value: 'x' } })]))
    expect(rows[0]).not.toContain('Respuesta abierta')
  })

  it('survives a header with a semicolon and an answer with a line break', () => {
    const snap = snapshot(
      'v1',
      '2026-01-01T00:00:00.000Z',
      [makeQuestion({ id: 'Q1', type: 'short_text', label: 'Uno; dos' })],
      { openQuestion: { text: 'Comentarios' } },
    )
    const rows = parse(
      buildMatrixCsv([
        makeRow('r1', snap, { Q1: { kind: 'text', value: 'a\r\nb' } }, { open_answer: 'línea1\r\nlínea2' }),
      ]),
    )

    expect(rows[0]).toContain('Uno; dos')
    expect(cell(rows, 1, 'Uno; dos')).toBe('a\r\nb')
    expect(cell(rows, 1, 'Respuesta abierta')).toBe('línea1\r\nlínea2')
  })

  it('writes only a header when there is nothing to export', () => {
    expect(parse(buildMatrixCsv([]))).toHaveLength(1)
  })
})

// ─── The frequency table ────────────────────────────────────────────────────

describe('the frequency table', () => {
  it('counts an option nobody chose as zero rather than dropping it', () => {
    const snap = snapshot('v1', '2026-01-01T00:00:00.000Z', [
      COLOUR([
        ['a', 'Azul'],
        ['b', 'Blanco'],
      ]),
    ])
    const rows = parse(
      buildFrequencyCsv([makeRow('r1', snap, { Q1: { kind: 'options', optionIds: ['a'] } })]),
    )

    // A missing option reads as an oversight; a zero is a finding.
    expect(column(rows, find(rows, 'Color', 'Blanco')!, 'Respuestas')).toBe('0')
  })

  it('divides a newly added option by the people who were actually offered it', () => {
    // The trap: pooling it over everyone turns 6 of 12 into 15 %.
    const v1 = snapshot('v1', '2026-01-01T00:00:00.000Z', [COLOUR([['a', 'Azul']])])
    const v2 = snapshot('v2', '2026-02-01T00:00:00.000Z', [
      COLOUR([
        ['a', 'Azul'],
        ['b', 'Blanco'],
      ]),
    ])
    const pool = [
      makeRow('r1', v1, { Q1: { kind: 'options', optionIds: ['a'] } }),
      makeRow('r2', v1, { Q1: { kind: 'options', optionIds: ['a'] } }),
      makeRow('r3', v2, { Q1: { kind: 'options', optionIds: ['b'] } }),
    ]
    const rows = parse(buildFrequencyCsv(pool))
    const blanco = find(rows, 'Color', 'Blanco')!

    expect(column(rows, blanco, 'Respuestas')).toBe('1')
    expect(column(rows, blanco, 'Preguntados')).toBe('1') // not 3
  })

  it('keeps a removed option, with the people who could still see it', () => {
    const v1 = snapshot('v1', '2026-01-01T00:00:00.000Z', [
      COLOUR([
        ['a', 'Azul'],
        ['b', 'Blanco'],
      ]),
    ])
    const v2 = snapshot('v2', '2026-02-01T00:00:00.000Z', [COLOUR([['a', 'Azul']])])
    const rows = parse(
      buildFrequencyCsv([
        makeRow('r1', v1, { Q1: { kind: 'options', optionIds: ['b'] } }),
        makeRow('r2', v2, { Q1: { kind: 'options', optionIds: ['a'] } }),
      ]),
    )
    const blanco = find(rows, 'Color', 'Blanco')!

    expect(column(rows, blanco, 'Respuestas')).toBe('1')
    expect(column(rows, blanco, 'Preguntados')).toBe('1')
  })

  it('separates the count from the statistic, so Respuestas stays summable', () => {
    const snap = snapshot('v1', '2026-01-01T00:00:00.000Z', [
      makeQuestion({ id: 'Q1', type: 'number', label: 'Precio', text: 'Precio', unit: '€/kg' }),
    ])
    const rows = parse(
      buildFrequencyCsv([
        makeRow('r1', snap, { Q1: { kind: 'number', value: 10 } }),
        makeRow('r2', snap, { Q1: { kind: 'number', value: 21 } }),
      ]),
    )
    const media = find(rows, 'Precio (€/kg)', 'Media')!

    expect(column(rows, media, 'Respuestas')).toBe('2') // the n
    expect(column(rows, media, 'Valor')).toBe('15,50') // the mean
  })

  it('takes the median of an even set as the mean of the two middle values', () => {
    const snap = snapshot('v1', '2026-01-01T00:00:00.000Z', [
      makeQuestion({ id: 'Q1', type: 'number', label: 'P', text: 'P' }),
    ])
    const rows = parse(
      buildFrequencyCsv(
        [1, 2, 3, 4].map((value, index) =>
          makeRow(`r${index}`, snap, { Q1: { kind: 'number', value } }),
        ),
      ),
    )
    expect(column(rows, find(rows, 'P', 'Mediana')!, 'Valor')).toBe('2,50')
  })

  it('leaves the percentage empty rather than writing NaN', () => {
    const snap = snapshot('v1', '2026-01-01T00:00:00.000Z', [
      COLOUR([
        ['a', 'Azul'],
        ['b', 'Blanco'],
      ]),
    ])
    // Asked, answered nothing.
    const rows = parse(buildFrequencyCsv([makeRow('r1', snap, {})]))
    const azul = find(rows, 'Color', 'Azul')!

    expect(column(rows, azul, 'Respondieron')).toBe('0')
    expect(column(rows, azul, '%')).toBe('')
  })

  it('tells apart "was asked", "answered" and "wrote something"', () => {
    const snap = snapshot('v1', '2026-01-01T00:00:00.000Z', [
      makeQuestion({ id: 'Q1', type: 'short_text', label: 'Libre', text: 'Libre' }),
    ])
    const rows = parse(buildFrequencyCsv([makeRow('r1', snap, { Q1: { kind: 'text', value: '   ' } })]))
    const line = rows.slice(1).find((l) => l[rows[0]!.indexOf('Pregunta')] === 'Libre')!

    expect(column(rows, line, 'Respuestas')).toBe('0') // blank is not an answer
    expect(column(rows, line, 'Respondieron')).toBe('1')
    expect(column(rows, line, 'Preguntados')).toBe('1')
  })

  it('makes item nonresponse a line of its own', () => {
    const snap = snapshot('v1', '2026-01-01T00:00:00.000Z', [COLOUR([['a', 'Azul']])])
    const rows = parse(
      buildFrequencyCsv([
        makeRow('r1', snap, { Q1: { kind: 'options', optionIds: ['a'] } }),
        makeRow('r2', snap, {}),
      ]),
    )
    const missing = rows
      .slice(1)
      .find((l) => l[rows[0]!.indexOf('Tipo')] === 'Sin respuesta')!

    expect(column(rows, missing, 'Respuestas')).toBe('1')
  })

  it('never counts one questionnaire’s rows in the other’s denominator', () => {
    const companyAnswers: Answers = { 'C-Q01': { kind: 'option', optionId: 'secadero' } }
    const individualAnswers: Answers = { 'I-Q06': { kind: 'option', optionId: 'nunca' } }
    const rows = parse(
      buildFrequencyCsv([
        makeRow(
          'c1',
          buildSnapshot(QUESTIONNAIRES.company, companyAnswers, '2026-01-01T00:00:00.000Z'),
          companyAnswers,
        ),
        makeRow(
          'i1',
          buildSnapshot(QUESTIONNAIRES.individual, individualAnswers, '2026-01-02T00:00:00.000Z'),
          individualAnswers,
          { respondent_type: 'individual', questionnaire_id: 'individual' },
        ),
      ]),
    )

    const audience = rows[0]!.indexOf('Público')
    const offered = rows[0]!.indexOf('Preguntados')
    for (const line of rows.slice(1)) {
      if (line[offered] === '') continue
      expect(Number(line[offered])).toBeLessThanOrEqual(1)
    }
    expect(new Set(rows.slice(1).map((l) => l[audience]))).toEqual(
      new Set(['Empresa', 'Consumidor']),
    )
  })

  it('writes only a header when there is nothing to count', () => {
    expect(parse(buildFrequencyCsv([]))).toHaveLength(1)
  })
})

// ─── Invariants across both files ───────────────────────────────────────────

describe('both files', () => {
  const answers: Answers = {
    'C-Q01': { kind: 'option', optionId: 'secadero' },
    'C-Q05': { kind: 'options', optionIds: ['local', 'exportacion'] },
    'C-Q15': { kind: 'scaleRows', values: { 'aporta-valor': 5, controles: 2 } },
  }
  const pool = [
    makeRow(
      'r1',
      buildSnapshot(QUESTIONNAIRES.company, answers, '2026-01-01T00:00:00.000Z'),
      answers,
      { open_answer: 'un comentario' },
    ),
  ]

  it('never writes a decimal point', () => {
    // One regex that catches any future `String(n)` slipping back in.
    for (const csv of [buildMatrixCsv(pool), buildFrequencyCsv(pool)]) {
      for (const line of parse(csv)) {
        for (const value of line) {
          expect(value).not.toMatch(/^-?\d+\.\d+$/)
        }
      }
    }
  })

  it('keeps every Respuestas cell a whole number', () => {
    // The invariant the separate `Valor` column buys: the column an analyst
    // sums never holds a mean.
    const rows = parse(buildFrequencyCsv(pool))
    const index = rows[0]!.indexOf('Respuestas')
    for (const line of rows.slice(1)) {
      expect(line[index]).toMatch(/^\d+$/)
    }
  })

  it('names the file after the population it holds', () => {
    expect(exportFilename('matrix', 'company')).toBe('respuestas-empresas.csv')
    expect(exportFilename('frequency', 'individual')).toBe('frecuencias-consumidores.csv')
    expect(exportFilename('matrix', null)).toBe('respuestas-todas.csv')
  })
})

// ─── The breakdown ──────────────────────────────────────────────────────────

/** One line of the frequency file, located by segment, group and option. */
function findLine(
  rows: string[][],
  segment: string,
  group: string,
  question: string,
  option: string,
): string[] | undefined {
  const h = rows[0]!
  return rows
    .slice(1)
    .find(
      (l) =>
        l[h.indexOf('Segmento')] === segment &&
        l[h.indexOf('Grupo')] === group &&
        l[h.indexOf('Pregunta')] === question &&
        l[h.indexOf('Opción')] === option,
    )
}

describe('the breakdown by segment', () => {
  /** A cut («Tipo») with two groups, and an opinion question to cross it by. */
  const TIPO = makeQuestion({
    id: 'S1',
    type: 'single_choice',
    label: 'Tipo',
    text: '¿Qué tipo?',
    segment: true,
    options: [
      { id: 'mat', text: 'Matadero' },
      { id: 'gan', text: 'Ganadería' },
    ],
  })
  const OPINION = makeQuestion({
    id: 'Q2',
    type: 'single_choice',
    label: 'Rentabilidad',
    text: '¿Rentable?',
    options: [
      { id: 'si', text: 'Suficiente' },
      { id: 'no', text: 'Insuficiente' },
    ],
  })
  const snap = snapshot('v1', '2026-01-01T00:00:00.000Z', [TIPO, OPINION])

  /** Three mataderos, of which two say «Insuficiente»; one ganadería says so too. */
  const pool = [
    makeRow('r1', snap, {
      S1: { kind: 'option', optionId: 'mat' },
      Q2: { kind: 'option', optionId: 'no' },
    }),
    makeRow('r2', snap, {
      S1: { kind: 'option', optionId: 'mat' },
      Q2: { kind: 'option', optionId: 'no' },
    }),
    makeRow('r3', snap, {
      S1: { kind: 'option', optionId: 'mat' },
      Q2: { kind: 'option', optionId: 'si' },
    }),
    makeRow('r4', snap, {
      S1: { kind: 'option', optionId: 'gan' },
      Q2: { kind: 'option', optionId: 'no' },
    }),
  ]

  it('keeps the total and adds a block per group', () => {
    const rows = parse(buildFrequencyCsv(pool))

    expect(findLine(rows, '(total)', '(todas)', 'Rentabilidad', 'Insuficiente')).toBeDefined()
    expect(findLine(rows, 'Tipo', 'Matadero', 'Rentabilidad', 'Insuficiente')).toBeDefined()
    expect(findLine(rows, 'Tipo', 'Ganadería', 'Rentabilidad', 'Insuficiente')).toBeDefined()
  })

  it('computes a group’s percentage over that group, not over everybody', () => {
    // This is the whole point. Two of three mataderos say «Insuficiente»:
    // that is 66,7 % of mataderos, not 50 % of the four responses.
    const rows = parse(buildFrequencyCsv(pool))
    const mataderos = findLine(rows, 'Tipo', 'Matadero', 'Rentabilidad', 'Insuficiente')!

    expect(column(rows, mataderos, 'Respuestas')).toBe('2')
    expect(column(rows, mataderos, 'Respondieron')).toBe('3')
    expect(column(rows, mataderos, '%')).toBe('66,7')

    const total = findLine(rows, '(total)', '(todas)', 'Rentabilidad', 'Insuficiente')!
    expect(column(rows, total, '%')).toBe('75,0')
  })

  it('recomputes how many were asked inside each group', () => {
    const rows = parse(buildFrequencyCsv(pool))
    const ganaderias = findLine(rows, 'Tipo', 'Ganadería', 'Rentabilidad', 'Insuficiente')!
    expect(column(rows, ganaderias, 'Preguntados')).toBe('1')
  })

  it('leaves out a group nobody falls into, whose size the total already gives', () => {
    // Otherwise every unused option costs a hundred lines of zeros.
    const rows = parse(buildFrequencyCsv(pool.slice(0, 3))) // three mataderos
    const groups = new Set(rows.slice(1).map((l) => l[rows[0]!.indexOf('Grupo')]))

    expect(groups).toEqual(new Set(['(todas)', 'Matadero']))
    // And the empty group is still visible where it matters: its own count.
    const ganaderia = findLine(rows, '(total)', '(todas)', 'Tipo', 'Ganadería')!
    expect(column(rows, ganaderia, 'Respuestas')).toBe('0')
  })

  it('does not cross a cut with itself', () => {
    // «Of the mataderos, 100 % are mataderos» is noise.
    const rows = parse(buildFrequencyCsv(pool))
    expect(findLine(rows, 'Tipo', 'Matadero', 'Tipo', 'Matadero')).toBeUndefined()
    // But it is still there in the total block.
    expect(findLine(rows, '(total)', '(todas)', 'Tipo', 'Matadero')).toBeDefined()
  })

  it('gives a conditional question a zero denominator in the group that never saw it', () => {
    // The consumer questionnaire hangs fourteen questions off «¿come jamón?».
    // Inside the «Nunca» group they were offered to nobody, and must read 0
    // instead of borrowing the whole sample's numbers.
    const never: Answers = { 'I-Q06': { kind: 'option', optionId: 'nunca' } }
    const eats: Answers = {
      'I-Q06': { kind: 'option', optionId: 'semanal' },
      'I-Q14': { kind: 'option', optionId: 'igual' },
    }
    const rows = parse(
      buildFrequencyCsv([
        makeRow(
          'r1',
          buildSnapshot(QUESTIONNAIRES.individual, never, '2026-01-01T00:00:00.000Z'),
          never,
          { respondent_type: 'individual', questionnaire_id: 'individual' },
        ),
        makeRow(
          'r2',
          buildSnapshot(QUESTIONNAIRES.individual, eats, '2026-01-02T00:00:00.000Z'),
          eats,
          { respondent_type: 'individual', questionnaire_id: 'individual' },
        ),
      ]),
    )

    const h = rows[0]!
    const gated = rows
      .slice(1)
      .filter(
        (l) =>
          l[h.indexOf('Grupo')] === 'Nunca' && l[h.indexOf('Pregunta')] === 'Elección D.O. vs sin sello',
      )
    expect(gated.length).toBeGreaterThan(0)
    for (const l of gated) {
      expect(column(rows, l, 'Preguntados')).toBe('0')
      expect(column(rows, l, 'Respondieron')).toBe('0')
      expect(column(rows, l, '%')).toBe('')
    }
  })

  it('emits only the total for rows saved before the cuts existed', () => {
    const old = snapshot('v0', '2025-01-01T00:00:00.000Z', [
      makeQuestion({ id: 'Q1', type: 'single_choice', label: 'Algo', text: 'Algo', options: [{ id: 'a', text: 'A' }] }),
    ])
    const rows = parse(buildFrequencyCsv([makeRow('r1', old, { Q1: { kind: 'option', optionId: 'a' } })]))

    // No invented breakdown: every line belongs to the total block.
    const segments = new Set(rows.slice(1).map((l) => l[rows[0]!.indexOf('Segmento')]))
    expect(segments).toEqual(new Set(['(total)']))
  })

  it('never builds a group out of a multiple-choice question', () => {
    const multi = snapshot('v1', '2026-01-01T00:00:00.000Z', [
      { ...COLOUR([['a', 'Azul']]), segment: true },
    ])
    const rows = parse(
      buildFrequencyCsv([makeRow('r1', multi, { Q1: { kind: 'options', optionIds: ['a'] } })]),
    )
    const segments = new Set(rows.slice(1).map((l) => l[rows[0]!.indexOf('Segmento')]))
    expect(segments).toEqual(new Set(['(total)']))
  })
})

// ─── The data dictionary ────────────────────────────────────────────────────

describe('the data dictionary', () => {
  const answers: Answers = {
    'C-Q01': { kind: 'option', optionId: 'secadero' },
    'C-Q05': { kind: 'options', optionIds: ['local'] },
    'C-Q15': { kind: 'scaleRows', values: { 'aporta-valor': 5 } },
  }
  const pool = [
    makeRow(
      'r1',
      buildSnapshot(QUESTIONNAIRES.company, answers, '2026-01-01T00:00:00.000Z'),
      answers,
      { open_answer: 'algo' },
    ),
  ]

  it('has exactly one row per column of the matrix, in the same order', () => {
    // If the two ever drift apart it must fail here, not in the analysis.
    const matrix = parse(buildMatrixCsv(pool))[0]!
    const dictionary = parse(buildCodebookCsv(pool))
      .slice(1)
      .map((l) => l[0])

    // Exactly: strip the columns that describe themselves — the company
    // name, the date and the technical tail — and what is left must BE the
    // dictionary, in order. A column gained or lost on either side fails.
    const selfEvident = new Set([
      'Nombre de la empresa',
      'Fecha',
      'Fecha ISO',
      'Público',
      'Versión',
      'Identificador',
      'Sin resolver',
    ])
    expect(matrix.filter((header) => !selfEvident.has(header))).toEqual(dictionary)
  })

  it('says what a blank means on a multiple-choice column', () => {
    // The one thing nobody can guess six months later.
    const rows = parse(buildCodebookCsv(pool))
    const mercados = rows.slice(1).find((l) => l[0]!.startsWith('Mercados — '))!
    expect(column(rows, mercados, 'Valores posibles')).toBe('Sí | No | (vacío = no se preguntó)')
  })

  it('lists every option of a single-choice question, chosen or not', () => {
    const rows = parse(buildCodebookCsv(pool))
    const actividad = rows.slice(1).find((l) => l[0] === 'Tipo de actividad')!
    const values = column(rows, actividad, 'Valores posibles')

    expect(values).toContain('Matadero')
    expect(values).toContain('Secadero / industria elaboradora')
  })

  it('carries the version, because option sets change between them', () => {
    const rows = parse(buildCodebookCsv(pool))
    const actividad = rows.slice(1).find((l) => l[0] === 'Tipo de actividad')!
    expect(column(rows, actividad, 'Versión')).toBe(QUESTIONNAIRES.company.version)
  })

  it('describes the open question, which is in no list of questions', () => {
    const rows = parse(buildCodebookCsv(pool))
    expect(rows.slice(1).some((l) => l[0] === 'Respuesta abierta')).toBe(true)
  })

  it('gives a scale its range', () => {
    const rows = parse(buildCodebookCsv(pool))
    const grid = rows.slice(1).find((l) => l[0]!.startsWith('Valoración de la D.O. — '))!
    expect(column(rows, grid, 'Valores posibles')).toContain('1')
    expect(column(rows, grid, 'Valores posibles')).toContain('5')
  })

  it('writes only a header when there is nothing to describe', () => {
    expect(parse(buildCodebookCsv([]))).toHaveLength(1)
  })
})
