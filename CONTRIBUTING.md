# Contributing to GitHub Agent

Welcome to GitHub Agent by Dwarves Foundation! 🌟 We're excited to have you
contribute to our agentic system for streamlining GitHub workflows. This guide
will help you get started with contributing to the project.

## Getting Started

### Fork and Setup

1. Fork the repository on GitHub
2. Clone your fork:

```bash
git clone git@github.com:dwarvesf/github-agent.git
cd github-agent
```

3. Install dependencies: `pnpm install`

## Development Workflow

### Project Structure

The project is organized as a monorepo containing:

- Applications (`apps/`)
  - `agent`: Core automation service
  - `discord-bot`: Discord integration service
- Shared packages (`packages/`)
  - Configuration packages for ESLint, TypeScript, and Prettier

### Development Commands

- `pnpm dev`: Start all applications in development mode
- `pnpm build`: Build all applications and packages
- `pnpm lint`: Run linting
- `pnpm format`: Format code with Prettier

## Making Contributions

### Pull Requests

1. Create a new branch for your changes:

```bash
git checkout -b feat/your-feature
```

2. Make your changes following our coding standards
3. Write meaningful commit messages following
   [Conventional Commits](https://www.conventionalcommits.org/)
4. Push your changes and create a pull request

### Pull Request Guidelines

- Include tests for new features or bug fixes
- Update documentation as needed
- Follow the existing code style
- Keep pull requests focused on a single feature/fix

### Commit Convention

Follow the Conventional Commits specification:

- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `chore`: Maintenance tasks
- `refactor`: Code refactoring
- `test`: Adding or updating tests

## Getting Help

If you have questions or need help, you can:

- Open an issue for discussion
- Join our [Discord community](https://discord.gg/dwarvesv)
- Reach out to the maintainers

## License

By contributing to GitHub Agent, you agree that your contributions will be
licensed under its MIT license.
