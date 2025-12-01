/**
 * Output Formatter
 * Standardized output formatting for CLI and API responses
 */
import * as YAML from '@std/yaml'
import type { OutputFormat } from 'core/schemas/common.ts'

/**
 * Format output based on the requested format
 */
export function formatOutput<T>(
  data: T | T[],
  format: OutputFormat | undefined,
): T[] | string | void {
  const items = Array.isArray(data) ? data : [data]

  switch (format) {
    case 'raw':
      return items

    case 'json':
      return JSON.stringify(items, null, 2)

    case 'yaml':
      return YAML.stringify(items)

    case 'name':
      return items.map((item) => (item as { name?: string }).name ?? '').join('\n')

    case 'wide':
      return undefined

    default:
      return items
  }
}

/**
 * Format a single item output
 */
export function formatSingleOutput<T>(
  data: T | null,
  format: OutputFormat | undefined,
): T | string | void {
  if (data === null) {
    return format === 'json' ? 'null' : format === 'yaml' ? 'null\n' : undefined
  }

  switch (format) {
    case 'raw':
      return data

    case 'json':
      return JSON.stringify(data, null, 2)

    case 'yaml':
      return YAML.stringify(data)

    case 'name':
      return (data as { name?: string }).name ?? ''

    case 'wide':
      return undefined

    default:
      return data
  }
}

/**
 * Table formatting helpers for 'wide' output
 */
export interface TableColumn<T> {
  header: string
  accessor: (item: T) => string
  width?: number
  align?: 'left' | 'right' | 'center'
}

/**
 * Format data as a table for 'wide' output
 */
export function formatTable<T>(
  items: T[],
  columns: TableColumn<T>[],
): string {
  if (items.length === 0) {
    return columns.map((c) => c.header).join('\t')
  }

  // Calculate column widths
  const widths = columns.map((col) => {
    const headerWidth = col.header.length
    const maxDataWidth = Math.max(...items.map((item) => col.accessor(item).length))
    return col.width ?? Math.max(headerWidth, maxDataWidth)
  })

  // Format header
  const header = columns.map((col, i) => col.header.padEnd(widths[i])).join('  ')

  // Format rows
  const rows = items.map((item) =>
    columns.map((col, i) => {
      const value = col.accessor(item)
      const width = widths[i]
      switch (col.align) {
        case 'right':
          return value.padStart(width)
        case 'center': {
          const padding = Math.max(0, width - value.length)
          const leftPad = Math.floor(padding / 2)
          return ' '.repeat(leftPad) + value + ' '.repeat(padding - leftPad)
        }
        default:
          return value.padEnd(width)
      }
    }).join('  ')
  )

  return [header, ...rows].join('\n')
}

/**
 * Format age from a date
 */
export function formatAge(date: Date | string | undefined): string {
  if (!date) return 'Unknown'

  const now = Date.now()
  const then = date instanceof Date ? date.getTime() : new Date(date).getTime()
  const diff = now - then

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d`
  if (hours > 0) return `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return `${seconds}s`
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}
