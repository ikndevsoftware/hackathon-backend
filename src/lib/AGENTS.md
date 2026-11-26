# Infrastructure (src/lib)

## Overview

Shared infrastructure integrations: database access through Prisma, authentication through Better Auth, and request protection through Arcjet. Each integration is a global module or a standalone config file, imported once in `AppModule`.

## Key files

| File | Owns |
|---|---|
| `database/prisma.module.ts` | Global Nest module that exports `PrismaService` |
| `database/prisma.service.ts` | `PrismaService`, a `PrismaClient` using the `pg` driver adapter |
| `auth/auth.ts` | The Better Auth instance passed to `AuthModule.forRoot` |
| `arcjet/arcjet.rules.ts` | Builds the Arcjet rules and picks `LIVE` or `DRY_RUN` from `ARCJET_MODE` |

## Conventions

- Inject `PrismaService` through the constructor; never create a `PrismaClient` in a feature module.
- `auth/auth.ts` is the one exception: Better Auth needs a client outside the Nest container, so it builds its own `PrismaClient`.
- Keep the generated client at `src/generated/prisma` so it stays inside `rootDir`. Never edit those files, run `pnpm db:generate` instead.
- Arcjet mode comes from `ARCJET_MODE`; any value other than `LIVE` falls back to `DRY_RUN`.

## Gotchas

- `main.ts` creates the app with `bodyParser: false`. Better Auth reads the raw request body, so do not turn the Nest body parser back on.
- Responses under `/api/auth` skip the global response wrapper on purpose; the Better Auth client expects its own shape.
- `role` is declared with `input: false` and defaults to `PARTICIPANT`, so a user cannot set their own role at sign up.
- Arcjet runs in `DRY_RUN` unless `ARCJET_MODE=LIVE`, so denials are logged but not blocked.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
