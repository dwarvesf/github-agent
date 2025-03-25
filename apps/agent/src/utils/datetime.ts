import { format as dateFnsFormat } from 'date-fns'

export const formatDate = (
  date: Date,
  format?: 'yyyy-MM-dd' | 'MMMM d, yyyy',
) => dateFnsFormat(date, format ?? 'yyyy-MM-dd')
