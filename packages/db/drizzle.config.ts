import type { Config } from 'drizzle-kit'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Determine the DATABASE_URL from environment variables
const connectionString =
  process.env.DATABASE_URL ||
  `postgres://${process.env.DATABASE_USER || 'postgres'}:${process.env.DATABASE_PASSWORD || 'postgres'}@${process.env.DATABASE_HOST || 'localhost'}:${process.env.DATABASE_PORT || '5432'}/${process.env.DATABASE_NAME || 'github_agent'}`

export default {
  schema: './src/schema',
  out: './migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString,
  },
  verbose: true,
  strict: true,
} satisfies Config
