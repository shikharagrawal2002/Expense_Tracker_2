import * as XLSX from 'npm:xlsx@0.18.5'
// pdf-parse's default export works fine under Deno's npm compat layer.
import pdfParse from 'npm:pdf-parse@1.1.1'
import type { ExtractedContent } from './types.ts'

function isSpreadsheet(fileName: string, mimeType: string) {
  const lower = fileName.toLowerCase()
  return (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    lower.endsWith('.xlsx') ||
    lower.endsWith('.xls')
  )
}

function isCsv(fileName: string, mimeType: string) {
  return mimeType.includes('csv') || fileName.toLowerCase().endsWith('.csv')
}

function isPdf(fileName: string, mimeType: string) {
  return mimeType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf')
}

/** Minimal CSV line splitter that respects double-quoted fields containing commas. */
function parseCsvText(text: string): string[][] {
  return text
    .split(/\r\n|\r|\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const cells: string[] = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"'
            i++
          } else {
            inQuotes = !inQuotes
          }
        } else if (char === ',' && !inQuotes) {
          cells.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      cells.push(current.trim())
      return cells
    })
}

export async function extractContent(
  fileName: string,
  mimeType: string,
  bytes: Uint8Array,
): Promise<ExtractedContent> {
  if (isCsv(fileName, mimeType)) {
    const text = new TextDecoder('utf-8').decode(bytes)
    return { format: 'table', rows: parseCsvText(text) }
  }

  if (isSpreadsheet(fileName, mimeType)) {
    const workbook = XLSX.read(bytes, { type: 'array' })
    // Statements almost always have one meaningful sheet; if there are several,
    // use the one with the most non-empty rows (biggest table = the transaction list).
    let bestRows: string[][] = []
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
        header: 1,
        raw: false,
        defval: '',
      }) as unknown as string[][]
      if (rows.length > bestRows.length) bestRows = rows
    }
    return { format: 'table', rows: bestRows }
  }

  if (isPdf(fileName, mimeType)) {
    const result = await pdfParse(Buffer.from(bytes))
    const lines = String(result.text)
      .split(/\r\n|\r|\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    return { format: 'text', lines }
  }

  throw new Error(
    `Unsupported file type "${mimeType || fileName}". Upload a CSV, XLS/XLSX, or PDF statement.`,
  )
}
