import { Agent } from '@mastra/core'
import { createTool } from '@mastra/core/tools'
import * as z from 'zod'
import { openai } from '@ai-sdk/openai'
import {
  format,
  subDays,
  startOfMonth,
  startOfYear,
  subMonths,
  subYears,
  endOfMonth,
  endOfYear,
} from 'date-fns'
import { formatDate } from '../../utils/datetime'

const extractDateRangeFromTextAgent = new Agent({
  name: 'Date Range Extractor',
  instructions: `Extract date range from text and return in JSON format {from: string}.
    The values should be either YYYY-MM-DD or keywords like
    - "today"
    - "yesterday
    - "3 days ago"
    - "last 7 days"
    - "past week"
    - "this month"
    - "last 30 days"
    - "last month"
    - "last 90 days"
    - "past 3 months"
    - "2 months ago"
    - "this year"
    - "last 12 months"
    - "last year"
    - "past 2 years"
    - etc.
    If no date detected for either "from" or "to", return the field value as an empty string.
    Ensure the text is in English and number in digit format. e.g last two months should be "last 2 months"`,
  model: openai('gpt-4o-mini'),
})

export const getDateRangeTool = createTool({
  id: 'get-date-range',
  description:
    'Get date range based on the human readable description of the date range',
  inputSchema: z.object({
    prompt: z.string().describe('Human readable date range description'),
  }),
  outputSchema: z.object({
    from: z.string().describe('From date in YYYY-MM-DD format').nullable(),
    to: z.string().describe('To date in YYYY-MM-DD format').nullable(),
  }),
  execute: async ({ context }) => {
    // 1. Extract date range using the agent
    const response = await extractDateRangeFromTextAgent.generate(
      context.prompt,
    )

    const parseJSON = JSON.parse(response.text)
    const { from } = parseJSON

    const today = new Date('2025-03-18T10:38:24+07:00')

    // Helper function to parse relative time expressions
    const parseRelativeTime = (
      expr: string,
    ): { from: Date; to: Date | null } | null => {
      expr = expr.toLowerCase().trim()

      // Single day cases
      switch (expr) {
        case 'today':
          return { from: today, to: null }
        case 'yesterday':
          return { from: subDays(today, 1), to: subDays(today, 1) }
      }

      // Handle "this" periods
      if (expr === 'this month') {
        return { from: startOfMonth(today), to: today }
      }
      if (expr === 'this year') {
        return { from: startOfYear(today), to: today }
      }

      // Handle "last X days" or "past X days"
      const daysMatch = expr.match(/^(?:last|past)\s+(\d+)\s+days?$/)
      if (daysMatch && typeof daysMatch[1] === 'string') {
        const days = parseInt(daysMatch[1])
        return {
          from: subDays(today, days),
          to: today,
        }
      }

      // Handle "X days ago"
      const daysAgoMatch = expr.match(/^(\d+)\s+days?\s+ago$/)
      if (daysAgoMatch && typeof daysAgoMatch[1] === 'string') {
        const days = parseInt(daysAgoMatch[1])
        const date = subDays(today, days)
        return { from: date, to: date }
      }

      // Handle "past week"
      if (expr === 'past week') {
        return {
          from: subDays(today, 7),
          to: today,
        }
      }

      // Handle "last month" and "X months ago"
      const monthsAgoMatch = expr.match(/^(\d+)\s+months?\s+ago$/)
      if (monthsAgoMatch && typeof monthsAgoMatch[1] === 'string') {
        const months = parseInt(monthsAgoMatch[1])
        const date = subMonths(today, months)
        return { from: date, to: date }
      }

      if (expr === 'last month') {
        const lastMonth = subMonths(today, 1)
        return {
          from: startOfMonth(lastMonth),
          to: endOfMonth(lastMonth),
        }
      }

      // Handle "last X months" or "past X months"
      const monthsMatch = expr.match(/^(?:last|past)\s+(\d+)\s+months?$/)
      if (monthsMatch && typeof monthsMatch[1] === 'string') {
        const months = parseInt(monthsMatch[1])
        return {
          from: startOfMonth(subMonths(today, months)),
          to: endOfMonth(subMonths(today, 1)),
        }
      }

      // Handle "last year" and "past X years"
      if (expr === 'last year') {
        const lastYear = subYears(today, 1)
        return {
          from: startOfYear(lastYear),
          to: endOfYear(lastYear),
        }
      }

      const yearsMatch = expr.match(/^(?:last|past)\s+(\d+)\s+years?$/)
      if (yearsMatch && typeof yearsMatch[1] === 'string') {
        const years = parseInt(yearsMatch[1])
        return {
          from: startOfYear(subYears(today, years)),
          to: endOfYear(subYears(today, 1)),
        }
      }

      return null
    }

    // Process the date range
    const dateRange = parseRelativeTime(from)

    if (!dateRange) {
      // If it's already in YYYY-MM-DD format, return as is
      if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
        return { from, to: null }
      }
      return { from: '', to: '' }
    }

    return {
      from: formatDate(dateRange.from),
      to: dateRange.to ? formatDate(dateRange.to) : null,
    }
  },
})
