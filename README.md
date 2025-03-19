<h1 align="center">
    Github Agent
</h1>
<p align="center">
    <a href="https://github.com/dwarvesf">
        <img src="https://img.shields.io/badge/-make%20by%20dwarves-%23e13f5e?style=for-the-badge&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAsBAMAAADsqkcyAAAAD1BMVEUAAAD///////////////+PQt5oAAAABXRSTlMAQL//gOnhmfMAAAAJcEhZcwAAHsIAAB7CAW7QdT4AAACYSURBVHicndLRDYJAEIThMbGAI1qAYAO6bAGXYP81uSGBk+O/h3Mev4dhWJCkYZqreOi1xoh0eSIvoCaBRjc1B9+I31g9Z2aJ5jkOsYScBW8zDerO/fObnY/FiTl3caOEH2nMzpyZhezIlgqXr2OlOX617Up/nHnPUg0+LHl18YO50d3ghOy1ioeIq1ceTypsjpvYeJohfQEE5WtH+OEYkwAAAABJRU5ErkJggg==&&logoColor=white" alt="Dwarves Foundation" />
    </a>
    <a href="https://discord.gg/dwarvesv">
        <img src="https://img.shields.io/badge/-join%20the%20community-%235865F2?style=for-the-badge&logo=discord&&logoColor=white" alt="Dwarves Foundation Discord" />
    </a>
</p>

An agentic system designed to streamline the collaboration workflow of
development teams on GitHub.

Key features:

- Automated reminders for development blockers (code reviews, merge conflicts,
  etc)
- Pull request monitoring and review notifications
- Project progress tracking with work summaries

## Project Structure

### Apps

- `agent`: Core automation service using Mastra framework
- `discord-bot`: Discord integration service for notification

### Packages

- `eslint-config`: Shared ESLint configurations
- `typescript-config`: Shared TypeScript configurations
- `prettier-config`: Shared Prettier configurations

## Getting Started

### Prerequisites

- Node.js (v20.0+)
- pnpm (v8.0+)
- Discord Bot Token (for discord-bot app)
- GitHub Token (for agent app)

### Setup

1. Clone the repository:

```bash
git clone https://github.com/dwarvesf/github-agent.git
cd github-agent
```

2. Install dependencies:

```bash
pnpm install
```

3. Copy environment files:

```bash
cp apps/agent/.env.example apps/agent/.env
cp apps/discord-bot/.env.example apps/discord-bot/.env
```

4. Configure environment variables:

- Set up GitHub tokens and configurations in `apps/agent/.env`
- Configure Discord bot settings in `apps/discord-bot/.env`

5. Start development:

```bash
pnpm dev
```

## Development

- `pnpm dev`: Start all applications in development mode
- `pnpm build`: Build all applications and packages
- `pnpm lint`: Run linting
- `pnpm format`: Format code with Prettier

## Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md)
for details on our code of conduct and the process for submitting pull requests.
