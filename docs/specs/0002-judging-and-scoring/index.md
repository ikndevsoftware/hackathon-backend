# 0002. Add judging and scoring with weighted totals

**Date**: 2026-11-27
**Status**: In Progress

## Summary

This feature lets the hackathon author set a scoring rubric with weighted criteria and assign judges from the people who have accounts. Judges score each published project after the event ends, and each project gets a weighted total that only the author and the assigned judges can read. Scores live in their own table so a judge can revise them until the author locks scoring, and the total is computed when it is read rather than stored.

The rubric freezes when the event ends, which is before any score can exist, so a total always means the same thing. It closes the loop from a submitted project to a comparable number that the results feature can publish later.

## Requirements

**User stories**:

* As a hackathon author, I want to define named criteria with weights so that judging follows an agreed rubric.
* As a hackathon author, I want to assign judges to my event so that other people can score projects without becoming admins.
* As a judge, I want to see the published projects and the rubric so that I can score every entry consistently.
* As a judge, I want to save and revise my scores until scoring closes so that I can correct a mistake.
* As a hackathon author, I want each project to show a weighted total so that entries can be compared fairly.
* As a participant, I want my scores hidden until results are published so that judging stays independent.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):

* **AC-1**: The hackathon author creates a criterion named `name` with a weight from 1 to 100 and an optional nonnegative `position`. The name is 2 to 100 characters and unique in the hackathon. A duplicate name returns 409. Any other signed in user gets 403. Invalid values return 400 with the validation error array. A missing hackathon returns 404.
* **AC-2**: The author and assigned judges list criteria for a hackathon ordered by `position`, then `createdAt`, then `id`. Each item shows `id`, `name`, `weight`, and `position`. Any other signed in user gets 403. A missing hackathon returns 404.
* **AC-3**: While the hackathon end date is in the future, the author can add, edit, and delete criteria. Once the end date has passed, all three actions return 409 and the rubric does not change. An empty PATCH body returns 400. A criterion id that is missing or belongs to another hackathon returns 404.
* **AC-4**: The author assigns an existing user as a judge for the hackathon with a `userId` in the body. The checks run in this order: missing hackathon 404, unknown user 404, participant conflict 400, then duplicate assignment 409. An `ADMIN` may be assigned as a judge. A duplicate creates no second row. Any other signed in user gets 403.
* **AC-5**: Only the author lists assigned judges for the hackathon. Each item shows the assignment `id`, `userId`, `assignedAt`, and the user `name`. The list is ordered by `assignedAt` then `id`. Every other signed in user gets 403.
* **AC-6**: Only the author removes an assigned judge. If that judge has any score for that hackathon, or scoring is already locked, removal returns 409 and the assignment stays. A missing assignment returns 404. A removed judge with no scores can be reassigned only before the lock, and old scores cannot survive a reassignment.
* **AC-7**: An assigned judge lists the published projects for the hackathon through the dedicated judge route. Each item shows project `id`, `title`, `repoUrl`, `status`, and owner `name`, ordered by `createdAt` then `id`. Drafts are not included. A signed in user who is not an assigned judge, including the author unless separately assigned, gets 403.
* **AC-8**: After the hackathon end date and before scoring is locked, an assigned judge submits scores for one published project in one `PUT` with a `scores` array of `{ criterionId, value }`. The array must contain every criterion of the hackathon exactly once, with no duplicates, no unknown ids, and no ids from another hackathon. An empty array or a hackathon with no criteria returns 400. Each value is an integer from 1 to 10. An unpublished project, a project from another hackathon, or a request where the current time is not past the end date returns 400. A missing project returns 404.
* **AC-9**: A judge can resubmit the full score set for the same project before the lock. Upserting the same values leaves the saved rows and their `updatedAt` values unchanged and returns success. Changing a value updates only that row. No duplicate rows are created.
* **AC-10**: A judge cannot score a project from another hackathon, cannot score before the end date, and cannot score after the lock. Each returns 400. A user who is not an assigned judge gets 403. A criterion from another hackathon returns 400.
* **AC-11**: A judge reading `GET` scores for a project receives rows of `criterionId`, `criterionName`, `weight`, and `value` for their own scores only. The author receives those fields plus `judgeId` for every judge. Both shapes include `total`, rounded to two decimal places, and `incomplete`, a boolean. A participant or any other signed in user gets 403. A project from another hackathon or a missing project returns 404. With no scores, `total` is null and `incomplete` is true.
* **AC-12**: A judge's weighted score is the sum of value multiplied by weight divided by the sum of weights for that judge's full set. The project total is the average of the weighted scores of judges with a full set, rounded to two decimal places. It is computed on read and never stored. `incomplete` is true until every judge in the frozen judge list has a full set for that project. The judge list freezes when scoring is locked.
* **AC-13**: The author can lock scoring only when the current time is past the end date and at least one criterion and one assigned judge exist. A first lock sets `scoringLockedAt` once with a conditional update. A second lock skips the preconditions, leaves the time unchanged, and returns success. Locking freezes the judge list. After the lock, every score submission returns 400. There is no unlock route.
* **AC-14**: Deleting a hackathon that has criteria, judge assignments, or scores returns 409 with one message that names all three. The count and delete run in one transaction. This check runs before the existing project check. Deleting a hackathon with no judging data and no projects still works.
* **AC-15**: An owner cannot unpublish or delete a project that has at least one score. The score check runs before the end date check, so a scored project returns 409 even after the end date, and a project without scores keeps the existing 400 after the end date. The project stays published. Editing a scored project is still allowed until the end date.
* **AC-16**: A user assigned as a judge cannot join that hackathon as a participant, and a participant cannot be assigned as a judge. Both return 400 with a message that names the conflict. In the join flow the judge check runs after the missing hackathon, inactive, and ended checks, and before the duplicate join check.
* **AC-17**: Every route in this feature requires a session. A request without one is rejected by `AuthGuard` with 401 or 403, matching the existing project routes.

## Decision

**Chosen option**: Option 1: A per hackathon judge list with explicit criterion and score tables

An author owns the rubric and the judge list for one event. A `Criterion` belongs to a hackathon, a `HackathonJudge` links a user to a hackathon, and a `Score` holds one judge's value for one project on one criterion. Scores are written with a full set upsert and the weighted total is computed on read.

**Implementation skills**: `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:

New models:

| Field | Type | Notes |
|---|---|---|
| `Criterion.id` | String | primary key, `@default(cuid())` |
| `Criterion.hackathonId` | String | FK to `Hackathon.id`, `onDelete: Restrict` |
| `Criterion.name` | String | required, 2 to 100 characters |
| `Criterion.weight` | Int | required, 1 to 100 |
| `Criterion.position` | Int | `@default(0)`, nonnegative |
| `Criterion.createdAt` | DateTime | `@default(now())` |
| `Criterion.updatedAt` | DateTime | `@updatedAt` |

| Field | Type | Notes |
|---|---|---|
| `HackathonJudge.id` | String | primary key, `@default(cuid())` |
| `HackathonJudge.hackathonId` | String | FK to `Hackathon.id`, `onDelete: Restrict` |
| `HackathonJudge.userId` | String | FK to `User.id`, `onDelete: Cascade` |
| `HackathonJudge.assignedAt` | DateTime | `@default(now())` |

| Field | Type | Notes |
|---|---|---|
| `Score.id` | String | primary key, `@default(cuid())` |
| `Score.projectId` | String | FK to `Project.id`, `onDelete: Cascade` |
| `Score.judgeId` | String | FK to `User.id`, `onDelete: Cascade` |
| `Score.criterionId` | String | FK to `Criterion.id`, `onDelete: Restrict` |
| `Score.value` | Int | required, 1 to 10 |
| `Score.createdAt` | DateTime | `@default(now())` |
| `Score.updatedAt` | DateTime | `@updatedAt` |

Changed models: `Hackathon` gains `scoringLockedAt DateTime?`, `criteria Criterion[]`, and `judges HackathonJudge[]`. `User` gains `judgeAssignments HackathonJudge[]` and `scores Score[]`. `Project` gains `scores Score[]`.

Constraints: `Criterion` unique on `(hackathonId, name)`. `HackathonJudge` unique on `(hackathonId, userId)`. `Score` unique on `(judgeId, projectId, criterionId)`. Indexes on `Criterion.hackathonId`, `HackathonJudge.userId`, `Score.projectId`, `Score.judgeId`, and `Score.criterionId`. Table names are `criterion`, `hackathon_judge`, and `score` through `@@map`, matching the existing schema style.

**State transitions**:

```text
Rubric:   created -> editable (while end date is future) -> frozen (when end date passes)

Event:    event runs -> end date passes -> scoring open -> author locks -> locked (final)

Score set for one judge and project:
absent -> submitted -> revised (any number of times while scoring is open) -> frozen at lock
```

**Response contract**:

Every route returns 200 with the existing wrapper of `{ statusCode, message, data }`. There is no separate create status. Each route uses a fixed `@ResponseMessage` string: criteria create, update, and delete; judge assign and remove; scores submitted; scoring locked. Read routes return the default message. Validation failures use the existing array under `message`. All other errors use the default Nest error body with a plain string message. No error is wrapped in the success wrapper.

**API surface**:

All routes are nested under the hackathon and require a session. Author means the `Hackathon.authorId` matches `session.user.id`. Author routes carry `@Roles(['ADMIN'])` and then the ownership check.

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/hackathon/:hackathonId/criteria` | POST | name (req), weight (req), position (opt) | created criterion | author | 400 invalid, 403, 404 hackathon, 409 name or end date |
| `/hackathon/:hackathonId/criteria` | GET | none | criteria in order | author or assigned judge | 403, 404 hackathon |
| `/hackathon/:hackathonId/criteria/:criterionId` | PATCH | any of name, weight, position | updated criterion | author | 400 invalid or empty body, 403, 404, 409 end date |
| `/hackathon/:hackathonId/criteria/:criterionId` | DELETE | none | success message | author | 403, 404, 409 end date |
| `/hackathon/:hackathonId/judges` | POST | userId (req) | assignment | author | 400 participant, 403, 404 user or hackathon, 409 duplicate |
| `/hackathon/:hackathonId/judges` | GET | none | assigned judges | author | 403, 404 hackathon |
| `/hackathon/:hackathonId/judges/:userId` | DELETE | none | success message | author | 403, 404, 409 scores or lock |
| `/hackathon/:hackathonId/judging/projects` | GET | none | published projects with owner name | assigned judge | 403, 404 hackathon |
| `/hackathon/:hackathonId/projects/:projectId/scores` | PUT | scores array of `{ criterionId, value }` (req) | saved scores for caller | assigned judge | 400 invalid set or window, 403, 404 project or hackathon |
| `/hackathon/:hackathonId/projects/:projectId/scores` | GET | none | own or all score rows, total, incomplete | author or assigned judge | 403, 404 project or hackathon |
| `/hackathon/:hackathonId/lock-scoring` | POST | none | hackathon with lock time | author | 400 preconditions, 403, 404 hackathon |

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| every route | hackathon not found | `Hackathon` row for the path id, checked first |
| every author route | author identity | `Hackathon.authorId` compared with `session.user.id` |
| every judge route | judge identity | `HackathonJudge` row for `(hackathonId, session.user.id)` |
| create criterion | `hackathonId` | path param |
| create criterion | name, weight, position | request body, position defaults to 0 |
| create criterion | duplicate 409 | `P2002` on `(hackathonId, name)` |
| list criteria | ordering and fields | `Criterion.position`, `createdAt`, `id`, name, weight |
| change criterion | end date freeze | `Hackathon.endDate` compared with the current time |
| change criterion | missing or foreign criterion | `Criterion` row matched by id and `hackathonId` |
| judge assignment | `hackathonId` | path param |
| judge assignment | `userId` | request body |
| judge assignment | unknown user 404 | `User` row for the body id |
| judge assignment | participant conflict | `HackathonParticipant` row for `(hackathonId, userId)`, checked before duplicate |
| judge assignment | duplicate 409 | `P2002` on `(hackathonId, userId)` |
| judge assignment | assignment response | `HackathonJudge.id`, `hackathonId`, `userId`, `assignedAt` |
| list judges | fields and ordering | `HackathonJudge.assignedAt`, `id`, `userId`, and `User.name` |
| remove judge | score guard | count of `Score` rows for `judgeId` in this hackathon |
| remove judge | lock guard | `Hackathon.scoringLockedAt` |
| judge project list | eligible rows | `Project.hackathonId` from path and `Project.status` equals `PUBLISHED` |
| judge project list | fields and ordering | `Project.id`, `title`, `repoUrl`, `status`, `createdAt`, `id`, and `User.name` |
| submit scores | `judgeId` | `session.user.id` |
| submit scores | `projectId` | path param |
| submit scores | criterionId and value | request body array |
| submit scores | exact set check | `Criterion` ids for the hackathon compared with the array ids |
| submit scores | open window | current time greater than `Hackathon.endDate` and `scoringLockedAt` null |
| submit scores | eligible project | `Project.status` equals `PUBLISHED` and `hackathonId` matches path |
| submit scores | unchanged resubmit | existing `Score.value` compared with the incoming value before update |
| read scores | visible rows | `Score.judgeId` compared with session id, all rows for author |
| read scores | row fields | `Score.value`, `Criterion.id`, `Criterion.name`, `Criterion.weight`, `Score.judgeId` for author |
| read scores | weighted total | computed from `Score.value` and `Criterion.weight`, rounded to two decimals |
| read scores | incomplete flag | count of judges with a full set from the frozen judge list |
| lock scoring | preconditions | current time, count of criteria, count of judges |
| lock scoring | idempotent lock | conditional update where `scoringLockedAt` is null |
| rubric freeze | end date | `Hackathon.endDate` compared with current time |
| hackathon delete block | judging data present | counts of criteria, judges, and scores inside one transaction |
| project unpublish and delete block | scored project | count of `Score` rows for the project, checked before the end date |
| join block | judge present | `HackathonJudge` row for `(hackathonId, userId)` |

**Key invariants**:

* One criterion name per hackathon, one judge assignment per user per hackathon, and one score per judge per project per criterion. All are enforced by unique database keys.
* Every score refers to a judge, a criterion, and a project from the same hackathon. The service checks this before writing because the database cannot express it with a simple key.
* The rubric never changes once the end date has passed. That is earlier than any score can exist.
* A score value is an integer from 1 to 10. A weight is an integer from 1 to 100.
* A judge cannot be a participant of the same hackathon. This is checked in both directions. Concurrent writes may still create both rows, so this invariant is application level only.
* A project with any score cannot be unpublished or deleted, even after the end date.
* A hackathon with any judging data cannot be deleted.
* Locking freezes the judge list and makes every score set final.
* A weighted total is never stored. It is derived from saved scores and the frozen rubric on every read.
* Scoring writes are rejected before the end date and after the lock.

**Security model**:

* Only the hackathon author creates criteria, assigns judges, removes judges, and locks scoring. Each author route uses `AuthGuard`, `@Roles(['ADMIN'])`, and the ownership check.
* Only an assigned judge submits scores and reads their own scores.
* The author reads every score and every total. Assigned judges read the rubric, the published project list, their own scores, and the total.
* Participants and other signed in users cannot read criteria, judge lists, scores, or totals before results are published. That publication is feature 7.
* Scores are not regulated data. They contain no payment, health, or sensitive personal data beyond the name and email already held by auth.
* No new environment variables or credentials are needed.

**Critical test scenarios**:

* Happy path: the author adds two criteria, assigns a judge, the event ends, the judge scores a published project, and the author reads the weighted total and incomplete flag, verifies **AC-1**, **AC-2**, **AC-4**, **AC-7**, **AC-8**, **AC-11**, **AC-12**.
* Repeat and replace: the judge resubmits the same set twice, then changes one value, and only one row per criterion remains with the expected `updatedAt`, verifies **AC-9**.
* Frozen rubric: modifying or deleting a criterion after the end date returns 409, verifies **AC-3**.
* Window and lock: scoring before the end date and after the lock returns 400, and locking twice is a no op, verifies **AC-8**, **AC-10**, **AC-13**.
* Permissions: a participant reads criteria and scores and gets 403, an unauthenticated request is rejected, verifies **AC-2**, **AC-11**, **AC-17**.
* Deletion guards: deleting a hackathon with judging data returns 409, and unpublishing a scored project after the end date returns 409, verifies **AC-14**, **AC-15**.
* Role conflict: assigning a participant as judge and joining as a participant when already a judge both return 400, verifies **AC-4**, **AC-16**.
* Total math: two judges with different value patterns produce the expected two decimal total and a complete flag, and a project with no scores returns a null total, verifies **AC-11**, **AC-12**.

## Build plan

Ordered as Tracer Bullet slices. The first slices stand up a thin real path from rubric to score to total, then the rest of the surface is added around it. The data model is the coherent target and lands in one migration, because the thin path cannot run without all three tables.

1. [x] Add the `Criterion`, `HackathonJudge`, and `Score` models with `criterion`, `hackathon_judge`, and `score` table names, add `Hackathon.scoringLockedAt`, wire relations and constraints, and create one migration, satisfies **AC-9**, **AC-12**.
2. [x] Add `CreateCriterionDto`, `UpdateCriterionDto`, `AssignJudgeDto`, and `SubmitScoresDto` with `class-validator` rules for name length and uniqueness at the service, weight range, position, userId, score array shape, exact set shape, and values from 1 to 10, satisfies **AC-1**, **AC-8**.
3. [x] Build `JudgingService` with the hackathon lookup, the author check, criterion create and list, judge assignment with unknown user and participant checks, and judge removal with the score and lock guards, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**.
4. [x] Add `JudgingController` and `JudgingModule` for criteria and judges, apply `AuthGuard` and `@Roles(['ADMIN'])`, wire the module into `AppModule`, and confirm an author can create a rubric and assign a judge end to end, satisfies **AC-1**, **AC-2**, **AC-4**, **AC-5**, **AC-17**.
5. [x] Add the judge published project list route with the judge ownership check and the declared projection, satisfies **AC-7**.
6. [x] Add the score upsert route with a transaction, exact set validation, same hackathon checks, end date check, lock check, published check, and skip unchanged values, satisfies **AC-8**, **AC-9**, **AC-10**.
7. [x] Add the score read route with role filtered visibility, the two decimal weighted total, the null case, and the incomplete flag from the frozen judge list, satisfies **AC-11**, **AC-12**.
8. [x] Add criterion update and delete with the end date freeze check, satisfies **AC-3**.
9. [x] Add the scoring lock route with a conditional update, preconditions on first lock only, and judge list freeze, satisfies **AC-6**, **AC-13**.
10. [x] Update `HackathonService.remove` to count criteria, judges, and scores in one transaction before the project check and generalize its conflict message. Update `ProjectService.publish`, `unpublish`, and `remove` to check scores before the end date. Update `HackathonService.join` to reject judges after the date checks, satisfies **AC-14**, **AC-15**, **AC-16**.
11. [x] Run a smoke pass over every route and failure case, including the wrapper, the fixed messages, and the validation array, satisfies **AC-1** through **AC-17**.

## Consequences

**Positive**:

* The core loop now ends in a comparable score, so the results feature has a stable input.
* Judge assignment is scoped to one event and needs no change to the global role model.
* The end date freeze and the computed on read total keep past scores meaningful without a score count race.
* A judge can correct a score without creating duplicate rows or changing `updatedAt` when nothing changed.

**Negative / tradeoffs**:

* Author only management differs from the existing rule that any admin can edit any hackathon. A non author admin cannot help set up or close judging.
* Locking is final and freezes the judge list. An author who locks too early cannot reopen scoring or add a judge.
* The full set submission is stricter than saving one criterion at a time. A judge must score every criterion in one request.
* Every total read walks the saved scores for that project. At the 100 participant cap this is small, but it needs a query check before the cap grows.
* Two existing services gain new guards and one message changes, so this feature changes behavior outside its own module.
* The judge and participant conflict is checked in application code only. Two concurrent writes can still create both rows.

**Neutral**:

* One migration adds three tables and one nullable column. Existing rows are unaffected.
* No new environment variables, external services, or credentials are added.
* The weighted total is derived on read, so there is no stored aggregate to keep in sync.

## Follow-up

* [ ] Add an unlock route when results publishing is designed in feature 7, and decide whether totals may change after results are published.
* [ ] Add pagination to the judge project list and the criteria list before the participant cap grows past 100.
* [ ] Serialize judge assignment and join on `(hackathonId, userId)` if the concurrent conflict becomes a real problem.
* [ ] Keep the weighted total on the read path and measure it before considering a stored aggregate.
* [ ] The `prisma-client-api` skill is not referenced in `AGENTS.md`. Decide whether its conventions belong in root `AGENTS.md` or the `src/lib` context file, as already flagged in spec 0001.
* [ ] The auth and session model and the Hackathon and HackathonParticipant tables still have no spec. Record them before this feature's assumptions drift.
