import { Agent } from '@mastra/core';
import { createTool } from '@mastra/core/tools';
import * as z from 'zod';
import { openai } from '@ai-sdk/openai';
import {
  format,
  subDays,
  startOfWeek,
  startOfMonth,
  startOfYear,
  subMonths,
  subYears,
  addDays,
  endOfMonth,
  endOfYear,
} from 'date-fns';

const extractDateRangeFromTextAgent = new Agent({
  name: 'Date Range Extractor',
  instructions:
    'Extract date range from text and return in JSON format {from: string}. The values should be either YYYY-MM-DD or keywords like "today", "3 days ago", "past 3 months", "2 previous months", "last month", "last week", "this year", etc. If no date detected for either "from" or "to", return the field value as an empty string.',
  model: openai('gpt-4o-mini'),
});

export const getDateRangeTool = createTool({
  id: 'get-date-range',
  description:
    'Get date range based on the human readable description of the date range',
  inputSchema: z.object({
    prompt: z.string().describe('Human readable date range description'),
  }),
  outputSchema: z.object({
    from: z.string().describe('From date in YYYY-MM-DD format').optional(),
    to: z.string().describe('To date in YYYY-MM-DD format').optional(),
  }),
  execute: async ({ context }) => {
    // 1. Extract date range using the agent
    const response = await extractDateRangeFromTextAgent.generate(
      context.prompt,
    );

    const parseJSON = JSON.parse(response.text);
    const { from } = parseJSON;
    console.log('>>>', 'from', from);

    // Helper function to format date
    const formatDate = (date: Date) => format(date, 'yyyy-MM-dd');

    // Helper function to parse relative time expressions
    const parseRelativeTime = (expression: string): Date | null => {
      const today = new Date();
      let expr = expression.toLowerCase().trim();

      // Match patterns like "3 days ago", "3 day ago", "past 3 months", "2 previous months"
      const numberWords: { [key: string]: number } = {
        one: 1,
        two: 2,
        three: 3,
        four: 4,
        five: 5,
        six: 6,
        seven: 7,
        eight: 8,
        nine: 9,
        ten: 10,
      };

      // Convert word numbers to digits
      Object.entries(numberWords).forEach(([word, num]) => {
        expr = expr.replace(new RegExp(`\\b${word}\\b`, 'gi'), num.toString());
      });

      // More flexible regex that handles variations
      const match = expr.match(
        /^(\d+)?\s*(day|month|week|year)s?\s*(ago|past|previous|before)$/,
      );
      if (match) {
        const amount = match[1] ? parseInt(match[1]) : 1;
        const unit = match[2];

        switch (unit) {
          case 'day':
            return subDays(today, amount);
          case 'week':
            return subDays(today, amount * 7);
          case 'month':
            return subMonths(today, amount);
          case 'year':
            return subYears(today, amount);
          default:
            return null;
        }
      }

      // Handle special cases
      if (expr === 'yesterday') {
        return subDays(today, 1);
      }

      return null;
    };

    // 2. Convert keywords to actual dates
    const getDateFromKeyword = (keyword: string) => {
      if (!keyword) return null;

      const today = new Date();
      const relativeDate = parseRelativeTime(keyword);
      if (relativeDate) {
        return formatDate(relativeDate);
      }

      switch (keyword.toLowerCase().trim()) {
        case 'today':
          return formatDate(today);
        case 'yesterday':
          return formatDate(subDays(today, 1));
        case 'last week':
          return formatDate(startOfWeek(subDays(today, 7)));
        case 'this week':
          return formatDate(startOfWeek(today));
        case 'last month':
          return formatDate(startOfMonth(subMonths(today, 1)));
        case 'this month':
          return formatDate(startOfMonth(today));
        case 'last year':
          return formatDate(startOfYear(subYears(today, 1)));
        case 'this year':
          return formatDate(startOfYear(today));
        default:
          // If it's already in YYYY-MM-DD format, return as is
          if (/^\d{4}-\d{2}-\d{2}$/.test(keyword)) {
            return keyword;
          }
          return null;
      }
    };

    // Helper function to get the end date based on from date and keyword
    const getEndDate = (
      fromDate: string | null,
      fromKeyword: string,
    ): string | null => {
      if (!fromDate || !fromKeyword) return null;

      const today = new Date();
      const expr = fromKeyword.toLowerCase().trim();

      // For "today", we don't need a to date
      if (expr === 'today') return null;

      // For specific time ranges like "last week", "last month"
      if (expr.startsWith('last')) {
        const unit = expr.split(' ')[1];
        const fromDateObj = new Date(fromDate);

        switch (unit) {
          case 'week':
            return formatDate(addDays(fromDateObj, 6)); // Last week: from Monday to Sunday
          case 'month':
            return formatDate(endOfMonth(fromDateObj)); // Last month: from 1st to end of month
          case 'year':
            return formatDate(endOfYear(fromDateObj)); // Last year: from Jan 1 to Dec 31
        }
      }

      // For relative time expressions like "3 days ago", "2 months ago"
      const match = expr.match(
        /^(\d+)?\s*(day|month|week|year)s?\s*(ago|past|previous|before)$/,
      );
      if (match) {
        const unit = match[2];

        switch (unit) {
          case 'day':
            return formatDate(today); // From X days ago until today
          case 'week':
            return formatDate(today); // From X weeks ago until today
          case 'month':
            return formatDate(today); // From X months ago until today
          case 'year':
            return formatDate(today); // From X years ago until today
        }
      }

      // For "yesterday", return yesterday (single day)
      if (expr === 'yesterday') {
        return fromDate; // Same as from date for single day
      }

      return null;
    };

    let fromDate = from ? getDateFromKeyword(from) : null;
    let toDate = getEndDate(fromDate, from);

    return {
      from: fromDate ?? '',
      to: toDate ?? '',
    };
  },
});
