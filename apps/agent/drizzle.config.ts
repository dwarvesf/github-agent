import type { Config } from 'drizzle-kit'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Determine the DATABASE_URL from environment variables
// eslint-disable-next-line turbo/no-undeclared-env-vars
const connectionString = process.env.DATABASE_URL

export default {
  schema: './src/db/schema',
  out: './migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: connectionString!,
  },
  verbose: true,
  strict: true,
} satisfies Config
