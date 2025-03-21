export function groupBy<T, K extends keyof any>(
  array: T[],
  key: (item: T) => K,
): Record<K, T[]> {
  return array.reduce(
    (result, item) => {
      const groupKey = key(item)
      if (!result[groupKey]) {
        result[groupKey] = []
      }
      result[groupKey].push(item)
      return result
    },
    {} as Record<K, T[]>,
  )
}
export function jsonArrayToCSV<T extends Record<string, any>>(
  array: T[],
  separator: string = ',',
): string {
  if (array.length === 0) return ''

  const headers = Object.keys(array[0] as any)
  const headerRow = headers.join(separator)

  const rows = array.map((item) =>
    headers.map((header) => String(item[header])).join(separator),
  )

  return [headerRow, ...rows].join('\n')
}
