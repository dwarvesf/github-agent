# Coding Styles & Patterns Summary

## Code Style & Structure

- **Dependencies:** Manage via pnpm workspaces.
- **Language:** Use strict TypeScript everywhere.
- **Reuse:** Favor composition over inheritance.
- **Data Access:** Apply repository pattern (esp. Prisma).
- **Naming:** Use descriptive variable names (e.g., `isLoading`); use kebab-case
  for directories (e.g., `components/auth-wizard`).
- **Linting:** Adhere to shared ESLint config (`packages/eslint-config`).
- **TypeScript Config:** Use shared config (`packages/typescript-config`).

## Error Handling & Validation

- Prioritize robust error handling:
  - Use early returns for errors.
  - Use guard clauses for preconditions.
  - Use custom error types.

## Next.js (T3 Stack + Shadcn UI)

### UI & Styling

- **Tailwind CSS:** Primary utility-first styling framework.
- **Shadcn UI:** Use for composable UI components (Radix + Tailwind based),
  added directly to codebase.

### Optimization (App Router Focus)

- **Favor Server Components (RSC):** Maximize server rendering to reduce client
  bundles.
- **Minimize Client Components:** Use `'use client'` sparingly (only for browser
  APIs, effects, state).
- **Server Actions:** Prefer for forms/mutations to keep logic server-side.
- **Dynamic Imports:** Use `next/dynamic` for code splitting non-essential
  components/libs.

### Data Fetching & State (tRPC Integration)

- **tRPC:** Use for end-to-end typesafe APIs (backend router -> frontend call).
- **React Query:** Use (via tRPC integration) for server state (caching,
  refetching, etc.).
- **Client State:** Use Zustand/Context for UI state not covered by React Query.
- **Zod:** Use rigorously for schema declaration and validation (tRPC I/O, env
  vars, forms).

### Core Principles

- **End-to-End Type Safety:** Maintain strict TypeScript across the stack
  (Frontend, tRPC, Prisma).
- **Prisma:** Use as the typesafe ORM for database interactions and migrations.

### Security & Performance

- **Input Validation:** Use Zod strictly on client (forms) and server (tRPC).
- **Error Handling:** Implement robust client/server error handling (hide
  sensitive details).
- **Security:** Follow secure coding practices (prevent XSS, CSRF); leverage
  framework security (e.g., NextAuth.js).
- **Performance:** Apply Next.js/React optimizations (bundle size, `next/image`,
  efficient data fetching).
