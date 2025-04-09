# Use Node.js base image
FROM node:18-alpine

# Set environment variables
ENV HUSKY=0
ENV PNPM_SKIP_PREINSTALL_CHECKS=1

# Set working directory
WORKDIR /app

# Copy package files first
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/eslint-config/ ./packages/eslint-config/
COPY packages/typescript-config/ ./packages/typescript-config/
COPY apps/agent/package.json ./apps/agent/
COPY apps/agent/prisma/ ./apps/agent/prisma/
# Install global dependencies
RUN npm install -g pnpm@latest turbo@latest

# Install project dependencies with specific versions
RUN pnpm install \
    --no-frozen-lockfile \
    --ignore-scripts \
    && cd apps/agent \
    && npx -y prisma generate \
    && pnpm add @mastra/core@0.6.4 mastra@0.4.3

# Copy remaining source files
COPY . .

ENV NODE_ENV=production

# Build the application
RUN pnpm turbo run build --filter=agent

# Make entrypoint script executable
RUN chmod +x /app/apps/agent/entrypoint.sh

# Expose the API port
EXPOSE 4111

# The following environment variables should be provided when running the container:
# - OPENAI_API_KEY
# - GITHUB_TOKEN
# - GITHUB_OWNER
# - GITHUB_REPO
# - DISCORD_BOT_BASE_URL
# - DISCORD_CHANNEL_ID
# - DATABASE_URL (if using a database)

# Set working directory for the entrypoint script
WORKDIR /app/apps/agent

# Run the application using the entrypoint script
ENTRYPOINT ["./entrypoint.sh"]
