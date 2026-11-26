# 0001. Add project submissions with a draft and publish state · rationale

**Date**: 2026-11-26

## Context

> Premise note: this feature assumes the existing auth and session model, and the Hackathon and HackathonParticipant tables. Those shipped before this workflow and have no spec. This spec treats them as fixed constraints. If you want them recorded as decisions, design them separately.

The project now stops at the join step. A participant can join an event, but there is no place to record what they built. The next features in the scope (judging and scoring, then results and standings) need a stable project entity to score and rank, so this feature defines that entity and the rules around it.

The forces at play:

- One event can have up to 100 participants, so the data volume is small and a full list is cheap.
- A participant should hold at most one project per event, so the one to one link between participant and project must be enforced.
- An organizer needs a trustworthy list of what was submitted, with the owner and the state of each project.
- The event has a hard end date, and submissions must stop changing after it.
- The existing code already uses NestJS modules, Prisma through `PrismaService`, DTO validation with `class-validator`, Better Auth roles, and a global response wrapper. This feature should follow those patterns, not invent new ones.

Not deciding this blocks the rest of the event loop: judging has nothing to score, and results have nothing to rank.

## Options considered

### Option 1: Separate Project table with a draft and publish state (chosen)

A new `Project` model links to one `Hackathon` and one `User`, with a unique pair on `(hackathonId, userId)`, a `ProjectStatus` enum, and the four content fields. A small set of nested routes creates, reads, edits, publishes, unpublishes, and deletes it. (basis: your scope feature 5, and the existing module and Prisma patterns in `src/module/hackathon/`)

**Pros**:
- A clean entity for judging and results to reference later.
- The one project per participant rule is enforced by the database, so races cannot create duplicates.
- Draft and publish give the participant control without a second table.

**Cons**:
- A new table, enum, migration, module, service, controller, and DTOs.
- The publish state has no visible effect yet, because only the owner and admins can read a project in this slice.

### Option 2: Store project fields on HackathonParticipant

Add title, repo, demo, and status columns to the existing join row instead of a new table. (basis: the existing `HackathonParticipant` model)

**Pros**:
- No new table and no join, since the row already ties a user to a hackathon.
- The uniqueness rule already exists on that row.

**Cons**:
- Mixes a join record with submission content, so the join table grows every time submissions change.
- Later judging would score a join row, which reads poorly and couples two concerns.
- Harder to evolve submissions without touching membership logic.

### Option 3: Project table without a status field

Create saves the project as final, and edit is the only mutation until the deadline. (basis: the plain reading of the scope sentence)

**Pros**:
- The smallest surface: one create, one read, one list, one edit, one delete.
- No state machine to reason about.

**Cons**:
- No way for a participant to hold work back until it is ready.
- The engineer chose a draft then publish flow, so this drops a stated requirement.

### Option 4: Project points at HackathonParticipant instead of User

Reference the join row as the owner, so the database guarantees membership. (basis: a stricter foreign key than the app check)

**Pros**:
- The database cannot store a project for a non member.
- Deleting the join row can remove the project in one cascade.

**Cons**:
- Deleting a participant would silently delete their project, which is a surprising side effect.
- Every read has to join through the participant row to reach the user.

## Rationale

A separate table is the right shape because judging and results will reference a project many times, and a project is not a membership record. Keeping it separate lets the join model stay about membership, and lets the project model grow (scores, results, files) without dragging membership along. (basis: the existing `Hackathon` and `HackathonParticipant` split, and your scope's later judging and results features)

The unique pair on `(hackathonId, userId)` is the cleanest way to enforce one project per participant. An application check alone would pass two rapid requests, so the database constraint plus a caught `P2002` gives a correct `409` under concurrency. (basis: uniqueness constraints for one per owner, and the existing `P2002` handling in `HackathonService.join`)

Draft and publish cost two small action routes, but they match how the engineer wants participants to work, and they give later features a signal for what is final. The tradeoff is honest: in this slice the state does not change who can read a project, because only the owner and admins can read either state. It is groundwork, and that is acceptable for a first strand. (basis: the engineer's draft then publish choice)

Blocking a hackathon delete while projects exist protects real work from an accidental cascade. The alternative, cascade delete, is faster for an admin but loses submitted projects with one click. (basis: the engineer's block the delete choice, and the principle that destructive actions should fail loudly)

## References

**Project sources** (verifiable, in this repo):

- `AGENTS.md`, the stack, the ESM import rule, and the build approach
- `docs/scope/scope.md`, feature 5, project submissions
- `src/module/hackathon/hackathon.controller.ts` and `hackathon.service.ts`, the existing route and service patterns
- `src/module/hackathon/dto/create-hackathon.dto.ts`, the existing validation style
- `prisma/schema.prisma`, the `Hackathon`, `HackathonParticipant`, and `User` models
- `src/lib/AGENTS.md`, the Prisma service and generated client notes

**Practices & standards**:

- One owner per record, enforced with a composite unique constraint plus a caught `P2002`
- Explicit state transitions with idempotent actions
- Nested REST resources under their parent
- `409 Conflict` for a uniqueness violation, `403` for ownership, `400` for a failed state check
- Destructive actions fail loudly (block a delete that would remove real work)
