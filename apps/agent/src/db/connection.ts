import { Pool, PoolConfig, PoolClient } from 'pg'
import { parse } from 'pg-connection-string'
import { drizzle } from 'drizzle-orm/node-postgres'
import { DB_CONNECTION } from '../config'

// Connection configuration
const getConnectionConfig = (): PoolConfig => {
  const connectionString = DB_CONNECTION.DATABASE_URL

  if (connectionString) {
    // Parse connection string if provided
    const config = parse(connectionString)
    return {
      host: config.host || undefined,
      port: config.port ? parseInt(config.port, 10) : 5432,
      database: config.database || undefined,
      user: config.user || undefined,
      password: config.password || undefined,
      ssl: DB_CONNECTION.DATABASE_SSL
        ? { rejectUnauthorized: false }
        : undefined,
    }
  }

  // Fallback to individual environment variables
  return {
    host: DB_CONNECTION.DATABASE_HOST,
    port: DB_CONNECTION.DATABASE_PORT,
    database: DB_CONNECTION.DATABASE_NAME,
    user: DB_CONNECTION.DATABASE_USER,
    password: DB_CONNECTION.DATABASE_PASSWORD,
    ssl: DB_CONNECTION.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
  }
}

// Create a singleton pool
let pool: Pool | null = null

/**
 * Get the database connection pool
 */
export const getPool = (): Pool => {
  if (!pool) {
    pool = new Pool(getConnectionConfig())

    // Handle errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err)
    })

    // Log connection success
    pool.on('connect', () => {
      console.log('Connected to PostgreSQL database')
    })
  }

  return pool
}

/**
 * Get a database client from the pool
 */
export const getClient = async (): Promise<PoolClient> => {
  const pool = getPool()
  const client = await pool.connect()

  // Set search path to use the agent schema
  await client.query('SET search_path TO agent_schema')

  return client
}

/**
 * Close the database connection pool
 */
export const closePool = async (): Promise<void> => {
  if (pool) {
    await pool.end()
    pool = null
    console.log('Database connection pool closed')
  }
}

/**
 * Get a drizzle ORM instance with the pool
 */
export const getDrizzle = () => {
  const db = drizzle(getPool(), {
    schema: { schema: 'agent_schema' },
  })
  return db
}
