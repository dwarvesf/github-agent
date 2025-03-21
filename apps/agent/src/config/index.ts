import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

export function getEnv<T extends boolean = true>(
  name: string,
  strict: T = true as T,
): T extends true ? string : string | undefined {
  const env = process.env[name]
  if (!env && strict) {
    throw new Error(`Missing required env: ${name}`)
  }

  return env as T extends true ? string : string | undefined
}

function getParseIntEnv(args: {
  name: string
  strict?: boolean
  fallback?: number
}) {
  const env = getEnv(args.name, args.strict)

  return env ? parseInt(env, 10) : args.fallback
}

function getBooleanEnv(args: {
  name: string
  strict?: boolean
  fallback?: boolean
}) {
  const env = getEnv(args.name, args.strict)

  return env ? env === 'yes' || env === 'true' : args.fallback
}

// GitHub API configuration
export const GITHUB_CONFIGURATION = {
  GITHUB_API_URL: 'https://api.github.com',
  GITHUB_TOKEN: getEnv('GITHUB_TOKEN'),
  GITHUB_OWNER: getEnv('GITHUB_OWNER'),
  GITHUB_REPO: getEnv('GITHUB_REPO'),
}

export const DB_CONNECTION = {
  DATABASE_URL: getEnv('DATABASE_URL', false),
  DATABASE_HOST: getEnv('DATABASE_HOST', false) || 'localhost',
  DATABASE_NAME: getEnv('DATABASE_NAME', false) || 'github_agent',
  DATABASE_USER: getEnv('DATABASE_USER', false) || 'agent_user',
  DATABASE_PASSWORD: getEnv('DATABASE_PASSWORD', false) || 'agent_password',
  DATABASE_PORT: getParseIntEnv({
    name: 'DATABASE_PORT',
    strict: false,
    fallback: 5432,
  }),
  DATABASE_SSL: getBooleanEnv({ name: 'DATABASE_SSL', strict: false }),
}

// Discord API configuration
export const DISCORD_CONFIGURATION = {
  DISCORD_BOT_BASE_URL: `${getEnv('DISCORD_BOT_BASE_URL')}/webhook`,
  DISCORD_CHANNEL_ID: getEnv('DISCORD_CHANNEL_ID', false) || '',
}
