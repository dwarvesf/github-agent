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

export function formatDateTimeInTz(
  date: Date,
  timezone = 'Asia/Ho_Chi_Minh',
  format?: Parameters<typeof formatDate>[1],
) {
  const dateInTz = new Date(
    date.toLocaleString('en-US', { timeZone: timezone }),
  )
  return formatDate(dateInTz, format)
}

export function takeSnapshotTime(date: Date = new Date()) {
  return `📸 Snapshot taken at ${formatDateTimeInTz(date, 'Asia/Ho_Chi_Minh', 'dd/MM/yy, HH:mm')}`
}

export function getStartOfDateInTz(date: Date, timezone = 'Asia/Ho_Chi_Minh') {
  // Convert the date to the specified timezone and set the time to midnight
  const dateInTz = new Date(
    date.toLocaleString('en-US', { timeZone: timezone }),
  )
  dateInTz.setHours(0, 0, 0, 0)
  return dateInTz
}
export function getEndOfDateInTz(date: Date, timezone = 'Asia/Ho_Chi_Minh') {
  // Convert the date to the specified timezone and set the time to 23:59:59
  const dateInTz = new Date(
    date.toLocaleString('en-US', { timeZone: timezone }),
  )
  dateInTz.setHours(23, 59, 59, 999)
  return dateInTz
}
