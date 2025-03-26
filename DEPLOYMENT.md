# Deployment Guide

This repository uses GitHub Actions to automatically deploy applications to
Fly.io when changes are detected. The deployment process is configured to only
deploy the applications that have changes, making it efficient for a monorepo
structure.

## Applications

The repository contains the following applications:

1. **Discord Bot** (`apps/discord-bot/`): A Discord bot based on Kevin Novak's
   Discord-Bot-TypeScript-Template.
2. **Agent** (`apps/agent/`): An agent application using Mastra.

## Deployment Process

The deployment process is automated using GitHub Actions and Fly.io:

1. When changes are pushed to the `main` branch, the GitHub Actions workflow is
   triggered.
2. The workflow detects which applications have changes.
3. For each application with changes, the workflow deploys it to Fly.io.

## Setup Instructions

### 1. Fly.io Setup

For each application you want to deploy:

1. Install the Fly.io CLI:

   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. Login to Fly.io:

   ```bash
   fly auth login
   ```

3. Create a new Fly.io app (if not already created):

   ```bash
   cd apps/discord-bot
   fly apps create github-agent-discord-bot

   cd ../agent
   fly apps create github-agent-app
   ```

4. Set up secrets for each app:

   ```bash
   # For Discord Bot
   cd apps/discord-bot
   fly secrets set DISCORD_BOT_ID=your_discord_bot_id DISCORD_BOT_TOKEN=your_discord_bot_token

   # For Agent
   cd ../agent
   fly secrets set OPENAI_API_KEY=your_openai_api_key GITHUB_TOKEN=your_github_token
   ```

### 2. GitHub Secrets Setup

Add the following secrets to your GitHub repository:

1. `FLY_API_TOKEN_DISCORD_BOT`: Fly.io API token for the Discord bot app
2. `FLY_API_TOKEN_AGENT`: Fly.io API token for the Agent app

To get a Fly.io API token:

```bash
fly auth token
```

### 3. Configuration Files

Each application has its own Fly.io configuration file (`fly.toml`) and
Dockerfile:

- **Discord Bot**:

  - `apps/discord-bot/fly.toml`
  - `apps/discord-bot/Dockerfile`

- **Agent**:
  - `apps/agent/fly.toml`
  - `apps/agent/Dockerfile`

You may need to adjust these files based on your specific requirements.

## Manual Deployment

You can manually trigger the deployment workflow from the GitHub Actions tab in
your repository. This will run the same workflow as if changes were pushed to
the `main` branch.

## Troubleshooting

### Deployment Failures

If a deployment fails, check the GitHub Actions logs for details. Common issues
include:

1. **Missing Secrets**: Ensure all required secrets are set in GitHub and
   Fly.io.
2. **Build Errors**: Check if the application builds successfully locally.
3. **Fly.io Quota**: Verify you haven't exceeded your Fly.io resource limits.
4. **pnpm Lockfile Compatibility**: The Dockerfiles use pnpm@8.15.4 with
   `--no-frozen-lockfile` to handle potential lockfile compatibility issues. If
   you encounter lockfile errors, you may need to update the pnpm version in the
   Dockerfiles.

### pnpm and Docker Build Troubleshooting

#### Package Management and Dependency Installation

This project uses pnpm for package management. The Dockerfile has been updated
to address common build and installation challenges:

1. **pnpm Version Management**

   - Uses the latest pnpm version
   - Automatically updates to the most recent stable release
   - Provides flexibility in dependency management

2. **Dependency Installation Flags**

   ```dockerfile
   RUN pnpm install \
       --no-frozen-lockfile \
       --ignore-scripts \
       --reporter=append-only
   ```

   Flag Explanations:

   - `--no-frozen-lockfile`: Allows lockfile updates
   - `--ignore-scripts`: Skips package lifecycle scripts
   - `--reporter=append-only`: Provides clean, minimal output

3. **Environment Variables for Build Control**

   ```dockerfile
   ENV HUSKY=0
   ENV PNPM_SKIP_PREINSTALL_CHECKS=1
   ```

   These variables:

   - Disable Husky git hooks
   - Skip pre-installation dependency checks
   - Reduce potential build-time friction

4. **Build Error Handling**
   ```dockerfile
   RUN pnpm build || (echo "Build failed" && exit 1)
   ```
   Ensures the build process fails explicitly if compilation fails

#### Common Build Issues and Solutions

1. **Dependency Conflicts**

   - Use `pnpm install --force` to resolve stubborn conflicts
   - Consider updating dependencies to compatible versions

2. **Script Execution Problems**

   - Use `--ignore-scripts` to bypass problematic lifecycle scripts
   - Manually review and fix package scripts if needed

3. **Version Compatibility** Recommended package.json configuration:
   ```json
   {
     "engines": {
       "node": ">=18.0.0",
       "pnpm": ">=8.0.0"
     }
   }
   ```

#### Debugging Docker Build

```bash
# Verbose build with build arguments
docker build \
  --progress=plain \
  -f apps/agent/Dockerfile \
  -t gh-agent .

# Inspect build cache and layers
docker history gh-agent
```

#### Recommended Workflow

1. Update dependencies regularly
2. Use `pnpm update` to refresh lockfile
3. Test locally before Docker build
4. Monitor build logs for warnings/errors

**Note**: Always test Docker builds in a clean environment to ensure
reproducibility.

### Mastra Build and Entry Point

The agent application uses Mastra for building, which can output files to
multiple locations. The entrypoint script is configured to check several
possible entry point locations for both .js and .mjs files:

1. `.mastra/.build/index.mjs`
2. `.mastra/output/index.mjs`
3. `.mastra/.build/index.js`
4. `.mastra/output/index.js`
5. And several other potential locations

Mastra's build process may create different directory structures:

- `.mastra/.build/`: Typically contains the compiled JavaScript files
- `.mastra/output/`: Another potential location for build output
- `dist/`: Standard TypeScript/JavaScript build output directory

### Troubleshooting Zod Schema and Undefined Function Errors

#### Specific Zod Schema Build Issue Diagnosis

The error suggests a critical problem with Zod schema transpilation during the
Mastra build process:

1. **Zod Schema Transpilation Problem**

   - Symptom: Zod schema methods replaced with `undefined()`
   - Location: Line 24951 in transpiled `index.mjs`
   - Potential Causes:
     - Incompatible Mastra and Zod versions
     - Incorrect build/transpilation configuration
     - Plugin or transformation issue in the build process

2. **Immediate Troubleshooting Steps**

   ```bash
   # Check exact versions of critical dependencies
   pnpm list zod @mastra/core mastra

   # Verify Zod import and usage
   grep -r "import.*zod" src/
   ```

3. **Dependency Version Compatibility** Current Versions:

   - Mastra: 0.2.8
   - Zod: Latest version recommended

   Recommended Actions:

   - Ensure Zod is explicitly compatible with Mastra
   - Check Mastra documentation for Zod integration
   - Consider pinning exact versions of dependencies

4. **Build Configuration Investigation**

   ```bash
   # Inspect Mastra build configuration
   cat mastra.config.js  # If exists

   # Check TypeScript and build settings
   cat tsconfig.json
   ```

5. **Potential Workarounds**

   ```typescript
   // Explicit type annotation to bypass transpilation issues
   const stepOneSchema = z.object({
     todayPRs: z.array(
       z.object({
         number: z.number().optional(),
         // Add .optional() to prevent undefined replacement
       }),
     ),
   }) satisfies z.ZodType
   ```

6. **Advanced Debugging**

   ```bash
   # Verbose Mastra build with debugging
   NODE_OPTIONS="--trace-warnings" pnpm build:debug

   # Inspect transpiled output in detail
   cat .mastra/output/index.mjs | grep -A 20 "stepOneSchema"
   ```

7. **Recommended Configuration Check** Ensure your `package.json` has:
   ```json
   {
     "dependencies": {
       "zod": "^3.22.0",
       "@mastra/core": "^0.4.4",
       "mastra": "^0.2.8"
     }
   }
   ```

#### Escalation Steps

If the issue persists:

- Create a minimal reproducible example
- Open an issue in the Mastra GitHub repository
- Provide:
  - Full error logs
  - Dependency versions
  - Minimal code demonstrating the problem

**Critical Note**: The `undefined()` replacement suggests a deep transpilation
or build system issue that may require framework-level investigation.

### Checking Deployment Status

To check the status of your deployments:

```bash
# For Discord Bot
fly status -a github-agent-discord-bot

# For Agent
fly status -a github-agent-app
```

### Viewing Logs

To view the logs of your deployed applications:

```bash
# For Discord Bot
fly logs -a github-agent-discord-bot

# For Agent
fly logs -a github-agent-app
```

## Additional Resources

- [Fly.io Documentation](https://fly.io/docs/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
