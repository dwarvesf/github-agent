# PostgreSQL Database Setup

This directory contains configuration for the PostgreSQL database used by the
Github Agent applications.

## Configuration

The PostgreSQL database is configured with a single shared database and separate
schemas for each application:

1. `agent_schema` - Schema for the Agent application
2. `discord_bot_schema` - Schema for the Discord Bot application

Each application has its own user with appropriate permissions:

| Application | Schema             | Username         | Password             |
| ----------- | ------------------ | ---------------- | -------------------- |
| Agent       | agent_schema       | agent_user       | agent_password       |
| Discord Bot | discord_bot_schema | discord_bot_user | discord_bot_password |

## Connection Information

- Host: `localhost` (when running locally)
- Port: `5432`
- Database: `github_agent`
- Default superuser: `postgres`
- Default superuser password: `postgres`

## Usage

To start the PostgreSQL database:

```bash
docker-compose up -d postgres
```

To connect to the PostgreSQL database using the command line:

```bash
# Connect as superuser
docker exec -it github-agent-postgres psql -U postgres -d github_agent

# Connect to specific schema as application user
docker exec -it github-agent-postgres psql -U agent_user -d github_agent
docker exec -it github-agent-postgres psql -U discord_bot_user -d github_agent
```

## Data Persistence

Database data is persisted in a Docker volume named
`github-agent-postgres-data`.

## Initialization

The database is initialized with the scripts located in the `init` directory:

- `01-init-databases.sql` - Creates database, users, and schemas

To reset the database completely, delete the Docker volume:

```bash
docker-compose down
docker volume rm github-agent-postgres-data
docker-compose up -d postgres
```
