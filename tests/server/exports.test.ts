import { describe, expect, it } from 'vitest'
import { buildLongCsv, buildWideCsv } from '../../server/exports'
import type { ResponseRow } from '../../server/responsesRepository'
import { buildSnapshot } from '../../src/data/snapshot'
import { QUESTIONNAIRES } from '../../src/data/questionnaires'
import type { Answers } from '../../src/data/types'
import { UTF8_BOM } from '../../server/csv'

function rowsOf(csv: string): string[][] {
  return csv
    .slice(UTF8_BOM.length)
    .trimEnd()
    .split('\r\n')
    .map((line) => line.split(';'))
}

const companyAnswers: Answers = {
  'C-Q01': { kind: 'option', optionId: 'secadero' },
  'C-Q05': { kind: 'options', optionIds: ['local', 'exportacion'] },
  'C-Q15': { kind: 'scaleRows', values: { 'aporta-valor': 5, controles: 2 } },
}

function companyRow(overrides: Partial<ResponseRow> = {}): ResponseRow {
  return {
    id: 'r1',
    created_at: '2026-03-04T09:05:00.000Z',
    respondent_type: 'company',
    identification: {},
    questionnaire_id: 'company',
    questionnaire_version: QUESTIONNAIRES.company.version,
    answers: companyAnswers,
    questionnaire: buildSnapshot(QUESTIONNAIRES.company, companyAnswers, '2026-03-04T09:05:00.000Z'),
    open_answer: null,
    ...overrides,
  }
}

describe('the wide export', () => {
  it('writes one row per response', () => {
    const rows = rowsOf(buildWideCsv([companyRow(), companyRow({ id: 'r2' })]))
    expect(rows).toHaveLength(3) // header + 2
  })

  it('writes choice answers as their option TEXT, not their id', () => {
    const [headers, row] = rowsOf(buildWideCsv([companyRow()]))
    const index = headers!.indexOf('C-Q01')
    expect(index).toBeGreaterThan(-1)
    expect(row![index]).toBe('Secadero / industria elaboradora')
  })

  it('joins multi-choice texts with a pipe', () => {
    const [headers, row] = rowsOf(buildWideCsv([companyRow()]))
    const index = headers!.indexOf('C-Q05')
    expect(row![index]).toBe('Local/provincial|Exportación')
  })

  it('gives every grid row its own column', () => {
    const [headers, row] = rowsOf(buildWideCsv([companyRow()]))
    expect(headers).toContain('C-Q15_aporta-valor')
    expect(headers).toContain('C-Q15_controles')
    expect(row![headers!.indexOf('C-Q15_aporta-valor')]).toBe('5')
    expect(row![headers!.indexOf('C-Q15_controles')]).toBe('2')
  })

  it('carries id, both dates, type, version and an answers count', () => {
    const [headers, row] = rowsOf(buildWideCsv([companyRow()]))
    expect(headers!.slice(0, 4)).toEqual(['id', 'date', 'date_iso', 'respondent_type'])
    expect(row![0]).toBe('r1')
    expect(row![2]).toBe('2026-03-04T09:05:00.000Z')
    expect(row![headers!.indexOf('answers_count')]).toBe('3')
    expect(row![headers!.indexOf('questionnaire_version')]).toBe(QUESTIONNAIRES.company.version)
  })

  it('never silently drops an answer the snapshot cannot resolve', () => {
    const orphaned = companyRow({
      answers: { ...companyAnswers, 'C-Q99': { kind: 'option', optionId: 'x' } },
    })
    const [headers, row] = rowsOf(buildWideCsv([orphaned]))

    expect(headers).toContain('C-Q99')
    expect(row![headers!.indexOf('C-Q99')]).toBe('x')
    expect(row![headers!.indexOf('unresolved')]).toBe('yes')
  })

  it('marks an option id missing from the snapshot as unresolved', () => {
    const renamed = companyRow({
      answers: { 'C-Q01': { kind: 'option', optionId: 'bodega' } },
    })
    const [headers, row] = rowsOf(buildWideCsv([renamed]))
    expect(row![headers!.indexOf('C-Q01')]).toBe('bodega')
    expect(row![headers!.indexOf('unresolved')]).toBe('yes')
  })

  it('leaves the unresolved column empty for a clean row', () => {
    const [headers, row] = rowsOf(buildWideCsv([companyRow()]))
    expect(row![headers!.indexOf('unresolved')]).toBe('')
  })
})

describe('the long export', () => {
  it('writes one row per answer, and one per grid row', () => {
    const rows = rowsOf(buildLongCsv([companyRow()]))
    // header + C-Q01 + C-Q05 + 2 grid rows
    expect(rows).toHaveLength(5)
  })

  it('carries the snapshotted section, label and text for each answer', () => {
    const [headers, ...body] = rowsOf(buildLongCsv([companyRow()]))
    const first = body[0]!
    expect(first[headers!.indexOf('section_id')]).toBe('identificacion')
    expect(first[headers!.indexOf('section_name')]).toBe(
      'Bloque 0 · Identificación de la empresa',
    )
    expect(first[headers!.indexOf('question_label')]).toBe('Tipo de actividad')
  })

  it('names the grid row it belongs to', () => {
    const [headers, ...body] = rowsOf(buildLongCsv([companyRow()]))
    const gridRows = body.filter((row) => row[headers!.indexOf('question_id')] === 'C-Q15')
    expect(gridRows).toHaveLength(2)
    expect(gridRows[0]![headers!.indexOf('row_id')]).toBe('aporta-valor')
    expect(gridRows[0]![headers!.indexOf('row_text')]).toBe('La D.O. aporta valor a mi negocio')
    expect(gridRows[0]![headers!.indexOf('answer_value')]).toBe('5')
  })

  it('keeps both the raw ids and the resolved texts', () => {
    const [headers, ...body] = rowsOf(buildLongCsv([companyRow()]))
    const multi = body.find((row) => row[headers!.indexOf('question_id')] === 'C-Q05')!
    expect(multi[headers!.indexOf('answer_value')]).toBe('local|exportacion')
    expect(multi[headers!.indexOf('answer_text')]).toBe('Local/provincial|Exportación')
  })

  it('exports the open answer as its own row', () => {
    const [headers, ...body] = rowsOf(buildLongCsv([companyRow({ open_answer: 'Más promoción' })]))
    const open = body.find((row) => row[headers!.indexOf('question_id')] === 'open_answer')
    expect(open).toBeDefined()
    expect(open![headers!.indexOf('answer_text')]).toBe('Más promoción')
  })

  it('marks an unresolvable answer rather than dropping it', () => {
    const orphaned = companyRow({
      answers: { 'C-Q99': { kind: 'option', optionId: 'x' } },
    })
    const [headers, ...body] = rowsOf(buildLongCsv([orphaned]))
    expect(body).toHaveLength(1)
    expect(body[0]![headers!.indexOf('unresolved')]).toBe('yes')
    expect(body[0]![headers!.indexOf('answer_value')]).toBe('x')
  })

  it('handles an empty result set', () => {
    expect(rowsOf(buildLongCsv([]))).toHaveLength(1)
    expect(rowsOf(buildWideCsv([]))).toHaveLength(1)
  })
})
