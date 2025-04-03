import { format as dateFnsFormat } from 'date-fns'

export const formatDate = (
  date: Date,
  format?: 'yyyy-MM-dd' | 'MMMM d, yyyy' | 'dd/MM/yy, HH:mm',
) => dateFnsFormat(date, format ?? 'yyyy-MM-dd')

/**
 * Helper method to calculate the difference in days between two dates
 */
export function getDaysDifference(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date1.getTime() - date2.getTime())
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

export function takeSnapshotTime(date: Date = new Date()) {
  return `📸 Snapshot taken at ${formatDate(date, 'dd/MM/yy, HH:mm')}`
}
