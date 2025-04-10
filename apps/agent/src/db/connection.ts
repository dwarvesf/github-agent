import dotenv from 'dotenv'

// Use dynamic import for PrismaClient
import { PrismaClient } from './'

// Load environment variables
dotenv.config()

// Create a singleton PrismaClient instance
let prisma: PrismaClient | null = null

/**
 * Get the Prisma client instance
 */
export const getPrisma = (): PrismaClient => {
  if (!prisma) {
    prisma = new PrismaClient({
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'error', 'warn']
          : ['error'],
    })

    console.log('Connected to PostgreSQL database with Prisma')
  }

  return prisma
}

/**
 * Disconnect the Prisma client
 */
export const disconnectPrisma = async (): Promise<void> => {
  if (prisma) {
    await prisma.$disconnect()
    prisma = null
    console.log('Database connection closed')
  }
}

/**
 * Legacy function for backwards compatibility - returns Prisma client
 * @deprecated Use getPrisma() instead
 */
export const getDrizzle = () => {
  console.warn('Warning: getDrizzle() is deprecated. Use getPrisma() instead.')
  return getPrisma()
}

/**
 * Legacy function for backwards compatibility
 * @deprecated Use disconnectPrisma() instead
 */
export const closePool = async (): Promise<void> => {
  console.warn(
    'Warning: closePool() is deprecated. Use disconnectPrisma() instead.',
  )
  await disconnectPrisma()
}

// For compatibility with existing code that might use these functions
export const getPool = () => {
  console.warn(
    'Warning: getPool() is deprecated. Database connection is now handled by Prisma.',
  )
  return getPrisma()
}

export const getClient = async () => {
  console.warn('Warning: getClient() is deprecated. Use getPrisma() instead.')
  return getPrisma()
}
