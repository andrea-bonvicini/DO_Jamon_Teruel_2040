/**
 * CSV tuned for Excel in a European locale:
 *   - UTF-8 BOM, so Excel does not mangle á, ñ and €
 *   - `;` separator, which is what Excel expects when the decimal mark is `,`
 *   - CRLF line endings
 *   - fields containing `"`, `;`, CR or LF are quoted, with `"` doubled
 */
export const CSV_SEPARATOR = ';'
export const CSV_NEWLINE = '\r\n'
export const UTF8_BOM = '﻿'

export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return ''

  const text = String(value)
  if (!/["\r\n;]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

export function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvField).join(CSV_SEPARATOR))
  return UTF8_BOM + lines.join(CSV_NEWLINE) + CSV_NEWLINE
}

/** `Content-Disposition` for a download, with the filename quoted. */
export function attachment(filename: string): string {
  return `attachment; filename="${filename}"`
}
