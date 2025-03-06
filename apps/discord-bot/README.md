# Discord Bot

This package is based on [Kevin Novak's Discord-Bot-TypeScript-Template](https://github.com/KevinNovak/Discord-Bot-TypeScript-Template).

## Setup

1. Create a `config.json` file in the `/apps/discord-bot/config/` directory using `config/config.example.json` as a template.
2. Set up your Discord bot credentials and other configurations in this file.

## Commands

From the root of the monorepo, you can run the following commands:

```bash
# Development
pnpm --filter discord-bot dev

# Build
pnpm build

# Register Discord bot commands
pnpm --filter discord-bot commands:register

# View registered commands
pnpm --filter discord-bot commands:view

# Other available commands
pnpm --filter discord-bot commands:rename  # Rename commands
pnpm --filter discord-bot commands:delete  # Delete commands
pnpm --filter discord-bot commands:clear   # Clear all commands
```

## Configuration

See the original template's documentation for detailed information on configuration options and bot features:
[Discord-Bot-TypeScript-Template Documentation](https://github.com/KevinNovak/Discord-Bot-TypeScript-Template)

## Running with PM2

You can use PM2 to manage the bot process:

```bash
# Start with PM2
pnpm --filter discord-bot start:pm2

# Stop PM2 processes
pnpm --filter discord-bot pm2:stop

# Delete PM2 processes
pnpm --filter discord-bot pm2:delete
```
