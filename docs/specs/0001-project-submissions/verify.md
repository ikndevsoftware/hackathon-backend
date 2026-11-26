# Verify: project submissions · spec 0001 · updated 2026-11-26

_Steps derived from spec 0001 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [x] Sign up two users, make one an admin by updating their role in the DB, and create an active hackathon as the admin → a hackathon id is returned → AC-1
- [x] As a signed in user who has not joined, POST create a project → 403 → AC-3
- [x] Join the hackathon as participant A, then POST create with only title and repoUrl → 201, status `DRAFT` → AC-1, AC-11
- [x] POST create a second time for the same participant and hackathon → 409, and the project count for that pair stays 1 → AC-2
- [x] PATCH the hackathon to `isActive` false, POST create → 400; restore `isActive` true → AC-4
- [x] Move the hackathon `endDate` into the past, then PATCH the project → 400, POST publish → 400, DELETE the project → 400 → AC-7, AC-8, AC-9
- [x] Restore the hackathon `endDate` to the future → AC-7
- [x] GET the project as its owner → 200; as another participant → 403; as an admin → 200 → AC-5
- [x] GET the project list as an admin → 200, includes both `DRAFT` and `PUBLISHED` projects, each with user id, name, email, and status; as a participant → 403 → AC-6
- [x] PATCH the project as owner → 200, status unchanged; POST publish → `PUBLISHED`; POST publish again → `PUBLISHED`; POST unpublish → `DRAFT`; POST unpublish again → `DRAFT` → AC-7, AC-8
- [x] DELETE a hackathon that still has a project → 409; DELETE the project, then the hackathon → 200 → AC-10
- [x] POST create with repoUrl `not-a-url`, and again with `ftp://example.com/x` → 400 with the `{ property, message }` array → AC-11
- [x] Call each project route with no cookie → 401 or 403 → AC-12
- [x] POST create with a body `userId` set to another user → the stored owner is still the session user (value source: `session.user.id`) → AC-1
- [x] Create a project under hackathon X, then GET it through hackathon Y's path → 404 (hackathon and owner never change)
- [x] PATCH a project as an admin who is not the owner → 403 (admins cannot write) → AC-7
- [x] POST create as an admin → 403 (only participants submit) → AC-1

## Commands

- [x] `pnpm db:migrate` → reports no pending migrations → AC-1
- [x] Query `information_schema.columns` for the `project` table → the ten expected columns exist and `status` defaults to `DRAFT` → AC-1
- [x] Query `pg_indexes` for the `project` table → the unique index `project_hackathonId_userId_key` exists → AC-2

## Acceptance-criteria coverage

- AC-1 … create step, schema command, session owner source step
- AC-2 … duplicate create step, unique index command
- AC-3 … not joined create step
- AC-4 … inactive and ended create steps
- AC-5 … owner, other participant, and admin read steps
- AC-6 … admin list step and participant list rejection
- AC-7 … owner edit step, admin write rejection, ended edit step
- AC-8 … publish and unpublish idempotency steps, ended publish step
- AC-9 … owner delete step and ended delete step
- AC-10 … hackathon delete blocked and allowed steps
- AC-11 … invalid repoUrl and demoUrl steps
- AC-12 … no cookie steps on every project route
