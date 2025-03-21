import type { Config } from 'drizzle-kit'
import { DB_CONNECTION } from './src/config'

export default {
  schema: './src/db/schema',
  out: './migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: DB_CONNECTION.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config
