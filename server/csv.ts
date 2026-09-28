/**
 * Two CSV profiles, deliberately different. Do not unify them.
 *
 * EXCEL_ES is for files a person opens: `;` separator, UTF-8 BOM, CRLF, and a
 * decimal comma. On 2026-09-24 the machine-format `18.5` was read as TEXT by
 * Excel in Spanish and the four price questions stopped being averageable —
 * `tests/server/csv.test.ts` pins that behaviour so it cannot be "fixed" back.
 *
 * MACHINE is for the microdata the analyst loads into R, Python or Stata:
 * RFC 4180 to the letter — `,` separator, no BOM, decimal point — because a
 * BOM shows up as a stray character in the first column name of half the
 * readers out there.
 */
export interface CsvProfile {
  separator: string
  newline: string
  bom: boolean
  /** How a number is written. The caller formats; this says which to use. */
  decimal: ',' | '.'
}

export const EXCEL_ES: CsvProfile = { separator: ';', newline: '\r\n', bom: true, decimal: ',' }
export const MACHINE: CsvProfile = { separator: ',', newline: '\r\n', bom: false, decimal: '.' }

export const CSV_SEPARATOR = EXCEL_ES.separator
export const CSV_NEWLINE = EXCEL_ES.newline
export const UTF8_BOM = '﻿'

/**
 * RFC 4180 quoting: a field is quoted when it holds a quote, a line break or
 * the profile's own separator, and inner quotes are doubled.
 *
 * Note the separator is per profile: a comma needs no quoting in the Excel
 * profile — which is what lets a decimal comma travel as a bare field — and
 * very much does in the machine one.
 */
export function escapeCsvField(value: unknown, profile: CsvProfile = EXCEL_ES): string {
  if (value === null || value === undefined) return ''

  const text = String(value)
  if (!text.includes('"') && !text.includes('\r') && !text.includes('\n') && !text.includes(profile.separator)) {
    return text
  }
  return `"${text.replace(/"/g, '""')}"`
}

export function toCsv(
  headers: string[],
  rows: Array<Array<unknown>>,
  profile: CsvProfile = EXCEL_ES,
): string {
  const lines = [headers, ...rows].map((row) =>
    row.map((field) => escapeCsvField(field, profile)).join(profile.separator),
  )
  return (profile.bom ? UTF8_BOM : '') + lines.join(profile.newline) + profile.newline
}

/** `Content-Disposition` for a download, with the filename quoted. */
export function attachment(filename: string): string {
  return `attachment; filename="${filename}"`
}
