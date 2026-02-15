/**
 * Turn an array of objects into CSV string and trigger download.
 * Escapes double quotes in values and wraps in quotes when needed.
 */
export function downloadCsv(
  rows: Record<string, unknown>[],
  filename: string,
  columns?: string[],
): void {
  if (rows.length === 0) {
    const keys = columns ?? []
    const header = keys.map((k) => escapeCsvValue(k)).join(',')
    triggerDownload(header + '\n', filename)
    return
  }
  const keys = columns ?? Object.keys(rows[0] ?? {})
  const header = keys.map((k) => escapeCsvValue(k)).join(',')
  const body = rows
    .map((row) =>
      keys.map((k) => escapeCsvValue(String(row[k] ?? ''))).join(','),
    )
    .join('\n')
  triggerDownload(header + '\n' + body, filename)
}

function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function triggerDownload(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
