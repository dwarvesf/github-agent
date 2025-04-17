# Use Node.js base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files for the monorepo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/eslint-config/ ./packages/eslint-config/
COPY packages/typescript-config/ ./packages/typescript-config/
COPY apps/discord-bot/package.json ./apps/discord-bot/

# Copy config examples
COPY apps/discord-bot/config/config.example.json ./apps/discord-bot/config/
COPY apps/discord-bot/config/bot-sites.example.json ./apps/discord-bot/config/
COPY apps/discord-bot/config/debug.example.json ./apps/discord-bot/config/

# Install global dependencies
RUN npm install -g pnpm@latest turbo@latest

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Copy remaining source files
COPY . .

ENV NODE_ENV=production

# Build the application
RUN pnpm turbo run build --filter=discord-bot

# Make entrypoint script executable
RUN chmod +x /app/apps/discord-bot/entrypoint.sh

# Install envsubst for variable replacement
RUN apk add --no-cache gettext

# Set working directory to the discord-bot app
WORKDIR /app/apps/discord-bot

# Expose the API, Webhook, Master port
EXPOSE 3001 4000 5000

# Run the entrypoint script
ENTRYPOINT ["./entrypoint.sh"]
