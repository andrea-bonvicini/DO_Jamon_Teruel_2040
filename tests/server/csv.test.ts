import { describe, expect, it } from 'vitest'
import { CSV_NEWLINE, UTF8_BOM, escapeCsvField, toCsv } from '../../server/csv'

describe('escapeCsvField', () => {
  it('leaves a plain field alone', () => {
    expect(escapeCsvField('Secadero')).toBe('Secadero')
  })

  it('renders null and undefined as empty', () => {
    expect(escapeCsvField(null)).toBe('')
    expect(escapeCsvField(undefined)).toBe('')
  })

  it('quotes a field containing the separator', () => {
    expect(escapeCsvField('a;b')).toBe('"a;b"')
  })

  it('quotes and doubles embedded quotes', () => {
    expect(escapeCsvField('dice "hola"')).toBe('"dice ""hola"""')
  })

  it('quotes a field containing a newline', () => {
    expect(escapeCsvField('línea 1\nlínea 2')).toBe('"línea 1\nlínea 2"')
    expect(escapeCsvField('a\rb')).toBe('"a\rb"')
  })

  it('does not quote a comma — the separator is a semicolon', () => {
    expect(escapeCsvField('22,5')).toBe('22,5')
  })

  it('stringifies numbers and booleans', () => {
    expect(escapeCsvField(42)).toBe('42')
    expect(escapeCsvField(0)).toBe('0')
    expect(escapeCsvField(false)).toBe('false')
  })
})

describe('toCsv', () => {
  const csv = toCsv(['a', 'b'], [[1, 'x;y'], [2, null]])

  it('starts with a UTF-8 BOM so Excel reads the accents', () => {
    expect(csv.startsWith(UTF8_BOM)).toBe(true)
  })

  it('separates with semicolons and ends lines with CRLF', () => {
    const lines = csv.slice(UTF8_BOM.length).split(CSV_NEWLINE)
    expect(lines[0]).toBe('a;b')
    expect(lines[1]).toBe('1;"x;y"')
    expect(lines[2]).toBe('2;')
  })

  it('terminates the last line', () => {
    expect(csv.endsWith(CSV_NEWLINE)).toBe(true)
  })

  it('emits just a header row when there are no rows', () => {
    const empty = toCsv(['only'], [])
    expect(empty).toBe(`${UTF8_BOM}only${CSV_NEWLINE}`)
  })
})
