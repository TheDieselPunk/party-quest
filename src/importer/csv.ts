// Minimal, robust CSV parser (RFC-4180-ish): handles quoted fields, embedded
// commas/newlines, and "" escapes. Returns an array of header-keyed records.
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field); field = ''
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = ''
    } else if (c !== '\r') {
      field += c
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }

  const header = (rows.shift() ?? []).map((h) => h.trim())
  return rows
    .filter((r) => r.some((v) => v !== ''))
    .map((r) => {
      const o: Record<string, string> = {}
      header.forEach((h, i) => { o[h] = (r[i] ?? '').trim() })
      return o
    })
}
