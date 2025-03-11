# @packages/db

A database package for handling PostgreSQL connections and operations in the GitHub Agent monorepo.

## Features

- PostgreSQL connection management with connection pooling
- Drizzle ORM integration for type-safe database operations
- Environment-based configuration with support for connection strings
- Repository pattern for common database operations

## Installation

This package is part of the GitHub Agent monorepo and is not published to npm. It is meant to be used internally by other packages in the monorepo.

```sh
# From the root of the monorepo
pnpm install
```

## Usage

### Importing the package

```typescript
// In any other package or app in the monorepo
import { getPool, getDrizzle, Repository } from "@packages/db";
```

### Basic connection

```typescript
import { getPool, closePool } from "@packages/db";

// Get a connection pool
const pool = getPool();

// Use the pool
const result = await pool.query("SELECT NOW()");
console.log(result.rows);

// Close the pool when done
await closePool();
```

### Using Drizzle ORM

```typescript
import { getDrizzle, users } from "@packages/db";

// Get a Drizzle instance
const db = getDrizzle();

// Query users
const allUsers = await db.select().from(users);
console.log(allUsers);
```

### Using the Repository

```typescript
import { Repository } from "@packages/db";

// Find all users
const allUsers = await Repository.findAllUsers();

// Find a user by ID
const user = await Repository.findUserById(1);

// Create a new user
const newUser = await Repository.createUser({
  email: "user@example.com",
  username: "user123",
  name: "Example User",
});

// Update a user
const updatedUser = await Repository.updateUser(1, {
  bio: "This is my updated bio",
});

// Delete a user
const deleted = await Repository.deleteUser(1);
```

## Environment Variables

The package supports the following environment variables:

- `DATABASE_URL`: Full PostgreSQL connection string (takes precedence if provided)
- `DATABASE_HOST`: PostgreSQL host (default: 'localhost')
- `DATABASE_PORT`: PostgreSQL port (default: 5432)
- `DATABASE_NAME`: Database name (default: 'github_agent')
- `DATABASE_USER`: Database user (default: 'postgres')
- `DATABASE_PASSWORD`: Database password (default: 'postgres')
- `DATABASE_SSL`: Use SSL connection if 'true' (default: undefined)

## Migrations

This package uses Drizzle Kit for database migrations.

To generate migrations based on schema changes:

```sh
# From the packages/db directory
pnpm drizzle-kit generate
```

To apply migrations:

```sh
# From the packages/db directory
pnpm drizzle-kit push
```

## Development

```sh
# From the packages/db directory
pnpm dev
```

## Building

```sh
# From the packages/db directory
pnpm build
```
