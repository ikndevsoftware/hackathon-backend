# Session notes

Last updated: 2026-11-26

## Snapshot

Hackathon backend built on NestJS 12 with ESM and the Express adapter. Data lives in Prisma 7 on a hosted Prisma Postgres database. Authentication uses Better Auth through `@thallesp/nestjs-better-auth`. Security uses Arcjet through `@arcjet/nest`. Validation uses `class-validator` and `class-transformer`. Tests use Vitest.

## Environment

Required values in `.env`:

1. `DATABASE_URL`
2. `BETTER_AUTH_SECRET`
3. `BETTER_AUTH_URL`
4. `ARCJET_KEY`
5. `ARCJET_ENV`
6. `ARCJET_MODE` (`DRY_RUN` or `LIVE`)

Commands:

```bash
pnpm start:dev
pnpm build
pnpm lint
pnpm test
pnpm db:format
pnpm db:migrate
pnpm db:generate
```

## What is built

1. `src/main.ts`: loads dotenv, disables the Nest body parser for Better Auth, registers the global response interceptor, and registers a global `ValidationPipe` with a custom exception factory.
2. `src/app.module.ts`: registers Arcjet (global module and global guard), `AuthModule.forRoot`, `PrismaModule`, `UserModule`, and `HackathonModule`.
3. `src/lib/auth/auth.ts`: Better Auth with the Prisma adapter, email and password enabled, and a `role` field marked `input: false` with `defaultValue: "PARTICIPANT"`.
4. `src/lib/database/prisma.module.ts` and `prisma.service.ts`: global Prisma module and service.
5. `src/common/`: response interceptor, `@ResponseMessage` decorator, and the validation exception factory.
6. `src/module/user/`: `GET /user/all` for admins and `GET /user/:id` for signed in users.
7. `src/module/hackathon/`: create, read, update, delete, and `POST /hackathon/:id/join`.
8. `test/fixtures/hackathons.json`: six valid request bodies for the create DTO.
9. `README.md`: current state and ordered next steps.

## API behaviour

1. Successful responses are wrapped as `{ statusCode, message, data }` with a default message of `"Success"`.
2. `/api/auth/*` responses are left unwrapped so the Better Auth client keeps its expected shape.
3. Errors use the Nest default body. Validation errors arrive as an array of `{ property, message }` under `message`.
4. Role checks compare the exact values `PARTICIPANT` and `ADMIN`.
5. Hackathon reads and user reads require a session. Only admins create, update, or delete hackathons. Only participants join.

## Database

Models: `User` (with the `Role` enum), `Session`, `Account`, `Verification`, `Hackathon`, and `HackathonParticipant`.

Migrations:

1. `20261118141754_init_auth`
2. `20261118145814_add_hackathon_and_participant`

The Prisma client is generated into `src/generated/prisma` so it stays inside `rootDir`.

## Known caveats

1. Arcjet runs in `DRY_RUN`, so it logs denials without blocking.
2. `@arcjet/nest` declares support for NestJS 10 and 11 only. It runs on NestJS 12 here, with a peer dependency warning.
3. `auth.ts` creates its own `PrismaClient` because Better Auth needs an instance outside the Nest container.
4. The database is remote, so smoke tests create and delete real users. Clean up after testing.
5. The repository has no commits yet. Everything shows as untracked.

## Next steps

See the "Next steps toward a full version" section in `README.md`.
