import { describe, expect, it, vi } from 'vitest'
import { downloadCsv, exportToCsv, formatCsvField, generateCsv } from './csv'

describe('CSV Utility', () => {
  describe('formatCsvField', () => {
    it('returns empty string for null and undefined', () => {
      expect(formatCsvField(null)).toBe('')
      expect(formatCsvField(undefined)).toBe('')
    })

    it('returns regular strings unchanged', () => {
      expect(formatCsvField('hello world')).toBe('hello world')
      expect(formatCsvField(123)).toBe('123')
      expect(formatCsvField(true)).toBe('true')
    })

    it('escapes commas, quotes, and newlines', () => {
      expect(formatCsvField('hello, world')).toBe('"hello, world"')
      expect(formatCsvField('hello "world"')).toBe('"hello ""world"""')
      expect(formatCsvField('line 1\nline 2')).toBe('"line 1\nline 2"')
      expect(formatCsvField('line 1\r\nline 2')).toBe('"line 1\r\nline 2"')
    })
  })

  describe('generateCsv', () => {
    it('generates proper CSV rows with headers', () => {
      const columns = [
        { header: 'Name', accessor: (row: { name: string; age: number }) => row.name },
        { header: 'Age', accessor: (row: { name: string; age: number }) => row.age },
      ]
      const data = [
        { name: 'John Doe', age: 30 },
        { name: 'Jane, Smith', age: 25 },
      ]

      const csv = generateCsv(columns, data)
      expect(csv).toBe('Name,Age\r\nJohn Doe,30\r\n"Jane, Smith",25')
    })
  })

  describe('downloadCsv and exportToCsv', () => {
    it('creates an anchor, triggers click, and cleans up', () => {
      const createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost/test')
      const revokeObjectURLMock = vi.fn()
      global.URL.createObjectURL = createObjectURLMock
      global.URL.revokeObjectURL = revokeObjectURLMock

      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click')

      exportToCsv(
        'users',
        [{ header: 'ID', accessor: (r: { id: string }) => r.id }],
        [{ id: '123' }],
      )

      expect(createObjectURLMock).toHaveBeenCalled()
      expect(clickSpy).toHaveBeenCalled()
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:http://localhost/test')

      clickSpy.mockRestore()
    })

    it('handles filename with or without .csv extension', () => {
      const createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost/test')
      global.URL.createObjectURL = createObjectURLMock
      global.URL.revokeObjectURL = vi.fn()

      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click')

      downloadCsv('report.csv', 'col1\r\nval1')
      expect(clickSpy).toHaveBeenCalled()

      clickSpy.mockRestore()
    })
  })
})
