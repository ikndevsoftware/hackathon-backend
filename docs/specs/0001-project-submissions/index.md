# 0001. Add project submissions with a draft and publish state

**Date**: 2026-11-26
**Status**: Accepted

## Summary

A participant who has joined a hackathon can create one project for that event, with a title, a repo link, and optional description and demo link. The project starts as a draft and the owner can publish or unpublish it, edit it, or delete it until the hackathon ends. Organizers can list every project for the event. This closes the first strand of the core loop, from a joined participant to a stored project that later judging and results can build on.

## Requirements

**User stories**:

- As a joined participant, I want to create and edit my project for the event, so that I can show what I built.
- As a joined participant, I want to keep my project in draft and publish it when ready, so that I control when it counts.
- As an organizer, I want to list every project for the event with its owner and state, so that I can see what was submitted.
- As the platform owner, I want one project per participant per hackathon, so that the data stays clean and judging stays fair.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):

- **AC-1**: A joined participant creates a project for an active hackathon whose end date is in the future, with title and repo link required and description and demo link optional. The created project has status `DRAFT`.
- **AC-2**: A second create attempt by the same participant for the same hackathon returns `409 Conflict` and does not create a second row.
- **AC-3**: A participant who has not joined the hackathon gets `403 Forbidden` on create.
- **AC-4**: Create against an inactive hackathon, or one whose end date has passed, returns `400 Bad Request` with a clear message.
- **AC-5**: The owner reads their own project by id. A different participant gets `403 Forbidden`. An admin can read any project.
- **AC-6**: An admin lists every project for a hackathon, including drafts and published projects, each with its owner and status. A non admin gets `403 Forbidden`.
- **AC-7**: The owner edits their project before the hackathon end date, and the status does not change. After the end date the edit returns `400 Bad Request`.
- **AC-8**: The owner publishes a draft and unpublishes a published project before the end date. Both actions are idempotent: repeating one leaves the status unchanged and returns success.
- **AC-9**: The owner deletes their project before the end date. After the end date the delete returns `400 Bad Request`.
- **AC-10**: Deleting a hackathon that still has projects returns `409 Conflict` with a clear message. Deleting a hackathon with no projects still works.
- **AC-11**: Repo and demo links must be absolute `http` or `https` URLs. Invalid values return `400 Bad Request` with the validation error array.
- **AC-12**: Every project route requires a session. A request without one is rejected by `AuthGuard`.

## Decision

**Chosen option**: Option 1: Separate Project table with a draft and publish state

A `Project` belongs to one `Hackathon` and one `User`, is unique per `(hackathonId, userId)`, starts as `DRAFT`, and moves between `DRAFT` and `PUBLISHED` through explicit owner actions until the hackathon ends. Admins read; owners write.

**Implementation skills**: `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`) (basis: the project already uses Prisma 7 and this feature adds a model and queries)

## Feature design

**Data model sketch**:

New enum:

```
enum ProjectStatus {
  DRAFT
  PUBLISHED
}
```

New model:

| Field | Type | Notes |
|---|---|---|
| id | String | primary key, `@default(cuid())` |
| hackathonId | String | FK to `Hackathon.id`, `onDelete: Restrict` |
| userId | String | FK to `User.id`, owner, `onDelete: Cascade` |
| title | String | required, 3 to 120 characters |
| description | String? | optional, up to 2000 characters |
| repoUrl | String | required, absolute `http` or `https` URL |
| demoUrl | String? | optional, absolute `http` or `https` URL |
| status | ProjectStatus | `@default(DRAFT)` |
| createdAt | DateTime | `@default(now())` |
| updatedAt | DateTime | `@updatedAt` |

Relations: `Hackathon` gains `projects Project[]`; `User` gains `projects Project[]`. Constraints: `@@unique([hackathonId, userId])`, `@@index([hackathonId])`, `@@index([userId])`, `@@map("project")`.

**State transitions**:

```
create -> DRAFT
DRAFT --publish (owner, before endDate)--> PUBLISHED
PUBLISHED --unpublish (owner, before endDate)--> DRAFT
DRAFT or PUBLISHED --edit (owner, before endDate)--> same state
DRAFT or PUBLISHED --delete (owner, before endDate)--> gone
```

Publish and unpublish are idempotent: calling publish on a published project, or unpublish on a draft, returns success with the state unchanged.

**API surface**:

All routes are nested under the hackathon and require a session.

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/hackathon/:hackathonId/projects` | POST | title (req), repoUrl (req), description (opt), demoUrl (opt) | project, status `DRAFT` | `PARTICIPANT`, joined | 400 inactive or ended, 403 not joined, 404 hackathon, 409 duplicate |
| `/hackathon/:hackathonId/projects` | GET | none | list of projects with owner and status | `ADMIN` | 403 non admin, 404 hackathon |
| `/hackathon/:hackathonId/projects/:projectId` | GET | projectId (path) | project with owner | owner or `ADMIN` | 403 not owner, 404 project |
| `/hackathon/:hackathonId/projects/:projectId` | PATCH | any of title, description, repoUrl, demoUrl | updated project, status unchanged | owner | 400 ended, 403 not owner, 404 project |
| `/hackathon/:hackathonId/projects/:projectId` | DELETE | none | success message | owner | 400 ended, 403 not owner, 404 project |
| `/hackathon/:hackathonId/projects/:projectId/publish` | POST | none | project, status `PUBLISHED` | owner | 400 ended, 403 not owner, 404 project |
| `/hackathon/:hackathonId/projects/:projectId/unpublish` | POST | none | project, status `DRAFT` | owner | 400 ended, 403 not owner, 404 project |

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| create | `hackathonId` | path param |
| create | `userId` (owner) | `session.user.id` |
| create | title, description, repoUrl, demoUrl | request body |
| create | initial status | `ProjectStatus.DRAFT` default |
| create | active and deadline check | `Hackathon.isActive` and `Hackathon.endDate` columns |
| create | joined check | a `HackathonParticipant` row for `(hackathonId, userId)` |
| read by id | owner check | `Project.userId` compared with `session.user.id` |
| read by id | admin check | `session.user.role` |
| admin list | owner display | `Project.user` relation, select id, name, email |
| admin list | status display | `Project.status` column |
| edit, delete, publish, unpublish | deadline check | `Hackathon.endDate` column |
| hackathon delete block | project count | count of `Project` rows for the hackathon |

**Key invariants**:

- One `Project` per `(hackathonId, userId)`, enforced by the database.
- A project's hackathon and owner never change after creation.
- A project can only be edited, deleted, published, or unpublished before the hackathon end date.
- `Project.status` is always `DRAFT` or `PUBLISHED`.
- A hackathon can only be deleted when it has zero projects.
- Repo and demo URLs are absolute `http` or `https` URLs.

**Security model**:

- Create: `PARTICIPANT` role, must have joined, hackathon active and not ended.
- Read one: any signed in user, but only the owner or an `ADMIN`.
- List: `ADMIN` only.
- Edit, delete, publish, unpublish: the owner only, before the end date. Admins cannot write.
- Drafts and published projects are visible to the owner and to admins. Nothing is public.
- No regulated data (no payment, health, or sensitive personal data beyond name and email already held by auth).

**Critical test scenarios** (each maps to an acceptance criterion):

- Happy path: a joined participant creates a draft, reads it, edits it, publishes it, unpublishes it, and an admin lists it. Verifies **AC-1**, **AC-5**, **AC-6**, **AC-7**, **AC-8**.
- Duplicate: a second create for the same participant and hackathon returns `409`. Verifies **AC-2**.
- Not joined: a participant who never joined gets `403` on create. Verifies **AC-3**.
- Ended event: create on an ended hackathon returns `400`; edit after the end date returns `400`. Verifies **AC-4**, **AC-7**.
- Permissions: an unauthenticated request gets `401`; a non owner read gets `403`; a non admin list gets `403`. Verifies **AC-5**, **AC-6**, **AC-12**.
- Hackathon delete: deleting a hackathon with projects returns `409`; with no projects it succeeds. Verifies **AC-10**.
- Invalid links: a non URL repo link returns `400` with the validation error array. Verifies **AC-11**.

## Build plan

Ordered as Tracer Bullet slices: a thin end to end create and read thread first, then the rest of the surface.

1. Add the `ProjectStatus` enum and `Project` model to `prisma/schema.prisma`, wire the `Hackathon` and `User` relations, and create one migration. Satisfies **AC-1**.
2. Add `CreateProjectDto` and `UpdateProjectDto` with `class-validator` rules: title 3 to 120, description up to 2000, repoUrl and demoUrl as `@IsUrl` with `http` and `https`. Satisfies **AC-1**, **AC-11**.
3. Add `ProjectService.create` with the joined check, the active and end date checks, the `DRAFT` default, and `P2002` to `409`. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**.
4. Add `ProjectController` and `ProjectModule` with `POST` create and `GET` by id, wire the module into `AppModule`, and confirm the create and read path works end to end. Satisfies **AC-1**, **AC-5**, **AC-12**.
5. Add the admin list route with owner and status in the response. Satisfies **AC-6**.
6. Add the edit route with the owner and end date checks, keeping the status unchanged. Satisfies **AC-7**.
7. Add the publish and unpublish routes, idempotent, owner only, before the end date. Satisfies **AC-8**.
8. Add the delete route, owner only, before the end date. Satisfies **AC-9**.
9. Update `HackathonService.remove` to count projects and return `409` with a clear message when any exist, leaving the no project case unchanged. Satisfies **AC-10**.
10. Run a smoke pass over every route, including the failure cases, and confirm the response wrapper and validation array still behave as before. Satisfies **AC-1** through **AC-12**.

## Consequences

**Positive**:

- The event loop has a real project entity that judging and results can reference.
- The one project per participant rule holds under concurrent requests.
- Participants control when a project is final, and organizers can see every project with its state.
- An accidental hackathon delete can no longer destroy submitted work.

**Negative / tradeoffs**:

- Publish and unpublish have no visibility effect in this slice, because the owner and admins already see both states. The state is groundwork for later features.
- The admin list returns every project with no pagination. That is fine at the 100 participant cap, but it should paginate before the cap grows.
- Blocking a hackathon delete changes existing admin behavior: a delete that used to succeed now returns `409` when projects exist.
- The feature adds seven routes, a new table, an enum, and a service with several rules, so it is more surface than a plain create and read.

**Neutral**:

- One migration adds the table and enum. Existing rows are unaffected.
- The existing join endpoint keeps its `400` duplicate response. Only the new project create uses `409`, so the two differ by design.

## Follow-up

- [ ] Add pagination to the admin project list before the participant cap grows past 100.
- [ ] The `prisma-client-api` skill is installed but not referenced in `AGENTS.md`. Decide where its conventions belong (root for project wide ORM rules, or the `src/lib` doc) so later builds load it.
- [ ] The existing auth and session model, and the Hackathon and HackathonParticipant tables, have no spec. Consider a short spec to record them.
- [ ] Judging and results specs should consume `Project.status` and treat only `PUBLISHED` projects as final, if that is the intent.
