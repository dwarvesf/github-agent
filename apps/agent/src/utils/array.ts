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
