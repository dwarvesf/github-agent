# GitHub Agent

A monorepo containing applications for GitHub automation and Discord
integration.

## Project Structure

### Apps

- `agent`: Core automation service using Mastra framework
- `discord-bot`: Discord bot for GitHub integration

### Packages

- `@packages/db`: Shared database utilities
- `@packages/typescript-config`: Shared TypeScript configurations

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
## What's inside?

This Turborepo includes the following packages/apps:

### Apps and Packages

- `docs`: a [Next.js](https://nextjs.org/) app
- `web`: another [Next.js](https://nextjs.org/) app
- `@packages/ui`: a stub React component library shared by both `web` and `docs` applications
- `@packages/eslint-config`: `eslint` configurations (includes `eslint-config-next` and `eslint-config-prettier`)
- `@packages/typescript-config`: `tsconfig.json`s used throughout the monorepo

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/).

### Utilities

This Turborepo has some additional tools already setup for you:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting

### Build

To build all apps and packages, run the following command:

```

cd my-turborepo pnpm build

```

### Develop

To develop all apps and packages, run the following command:

```

cd my-turborepo pnpm dev

```

## Tech Stack

- TypeScript
- PostgreSQL
- Mastra Framework
- Discord.js
- Turborepo

```
