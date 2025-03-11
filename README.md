# GitHub Agent

A monorepo containing applications for GitHub automation and Discord integration.

## Project Structure

### Apps

- `agent`: Core automation service using Mastra framework
- `discord-bot`: Discord bot for GitHub integration

### Packages

- `@repo/db`: Shared database utilities
- `@repo/typescript-config`: Shared TypeScript configurations

## Setup

1. Copy `.env.example` to `.env` and configure:
   - PostgreSQL database settings
   - Agent configuration
   - Discord bot settings

2. Install dependencies:
```sh
pnpm install
```

3. Start development:
```sh
pnpm dev
```

## Tech Stack

- TypeScript
- PostgreSQL
- Mastra Framework
- Discord.js
- Turborepo

