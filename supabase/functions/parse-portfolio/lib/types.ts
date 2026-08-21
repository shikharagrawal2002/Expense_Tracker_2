export type ExtractedContent =
  | { format: 'table'; rows: string[][] }
  | { format: 'text'; lines: string[] }