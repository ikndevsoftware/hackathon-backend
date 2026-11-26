# Hakcathon Backend

NestJS 11 project. Express adapter.

## Stack

- **Language / Runtime**: TypeScript 6 on Node 24, ESM (`"type": "module"`, `nodenext`)
- **Framework**: NestJS 12 with the Express adapter
- **Key dependencies**: Prisma 7 on PostgreSQL through `@prisma/adapter-pg`, Better Auth through `@thallesp/nestjs-better-auth`, Arcjet through `@arcjet/nest`, `class-validator` and `class-transformer`
- **Package manager**: pnpm

## Build approach

Tracer Bullet: each feature is a narrow, real thread through the whole stack before the next one starts.

## Commands

```bash
pnpm install        # install
pnpm start:dev      # dev server
pnpm build          # build
pnpm lint           # lint
pnpm test           # test
pnpm db:generate    # regenerate the Prisma client
pnpm db:migrate     # apply a migration
```

## Role

You are a senior NestJS developer. Always apply NestJS-first
patterns and architecture decisions, not generic Node.js approaches.

## Code standards

- Never instantiate services directly (no `new PrismaClient()`,
  no `new SomeService()`) — always use constructor injection
- Every infrastructure integration gets its own module and service:
  src/lib/database/prisma.module.ts + prisma.service.ts
  src/lib/mail/mail.module.ts + mail.service.ts
- Mark infrastructure modules @Global() and import once in AppModule
- Feature modules go in src/module/<name>/
- Shared guards, interceptors, decorators go in src/common/
- Use Nest CLI: nest g module / nest g service / nest g controller
- Relative imports end in `.js` because the project is ESM with `nodenext` module resolution

## Skills

Do not load any skill by default. Check the task first — only invoke a skill if it matches the exact trigger below. Never invoke a skill just because it exists.

- `/architect` — before building something non-trivial with no plan yet
- `/review` — when a feature is done and needs a production check
- `/recover` — when something is broken and the fix isn't obvious
- `/remember` — at the start of a new session to restore context,
  and at the end to save progress

## Session continuity

REQUIRED — do not skip, do not wait to be asked:

- **First action of every session:** run `/remember restore` before doing anything else.
- **Last action of every session:** run `/remember save` before closing.

## Context files

- [src/lib/AGENTS.md](src/lib/AGENTS.md): infrastructure layer (Prisma, Better Auth, Arcjet)
