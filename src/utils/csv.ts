export interface CsvColumn<T> {
  header: string
  accessor: (row: T) => string | number | boolean | null | undefined
}

export function formatCsvField(val: unknown): string {
  if (val === null || val === undefined) return ''
  const str = String(val)
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function generateCsv<T>(columns: CsvColumn<T>[], data: T[]): string {
  const headerRow = columns.map((c) => formatCsvField(c.header)).join(',')
  const rows = data.map((row) => columns.map((c) => formatCsvField(c.accessor(row))).join(','))

  return [headerRow, ...rows].join('\r\n')
}

export function downloadCsv(filename: string, csvContent: string): void {
  // UTF-8 BOM so spreadsheet programs (like Microsoft Excel) interpret UTF-8 properly
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })

  if (typeof window === 'undefined') return

  const url = URL.createObjectURL ? URL.createObjectURL(blob) : ''
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  if (url && URL.revokeObjectURL) {
    URL.revokeObjectURL(url)
  }
}

export function exportToCsv<T>(filename: string, columns: CsvColumn<T>[], data: T[]): void {
  const content = generateCsv(columns, data)
  downloadCsv(filename, content)
}
