# Verify: judging and scoring · spec 0002 · updated 2026-11-27

_Steps derived from spec 0002 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Setup: sign in as an `ADMIN` author. Create a hackathon whose `endDate` is in the future. Prepare a second user (`judge`) and a third user (`participant`), both signed in.

## API / manual

- [x] `POST /hackathon/:id/criteria` with name `Innovation` and weight `40` returns 200 in the wrapper `{ statusCode, message, data }` with message `Criterion created successfully`, and `data` shows `id`, `name`, `weight`, `position` (defaults to `0`) → AC-1
- [x] `POST` the same name again returns `409` → AC-1
- [x] `POST` with name `A` (under 2 characters), weight `0`, or weight `101` returns `400` with the validation array under `message` → AC-1
- [x] `POST` as the `participant` user returns `403`; `POST` to a non existent hackathon id returns `404` → AC-1
- [x] `GET /hackathon/:id/criteria` as author and as `judge` returns items ordered by `position`, then `createdAt`, then `id`, each with only `id`, `name`, `weight`, `position` → AC-2
- [x] `GET` criteria as the `participant` user returns `403`; for a missing hackathon returns `404` → AC-2
- [x] `PATCH /hackathon/:id/criteria/:criterionId` with a new weight returns 200 and message `Criterion updated successfully`; an empty `{}` body returns `400`; a missing id or an id from another hackathon returns `404`; a duplicate name returns `409` → AC-3
- [x] `DELETE /hackathon/:id/criteria/:criterionId` returns 200 with message `Criterion deleted successfully`; a foreign or missing id returns `404` → AC-3
- [x] Set the hackathon `endDate` into the past (via `PATCH /hackathon/:id`), then `POST`, `PATCH`, and `DELETE` criteria each return `409` and the rubric does not change → AC-3
- [x] `POST /hackathon/:id/judges` with the `judge` `userId` returns 200 with message `Judge assigned successfully` and `id`, `hackathonId`, `userId`, `assignedAt` → AC-4
- [x] Assign the same user again returns `409` and creates no second row; assign the `participant` user returns `400` and names the conflict; assign an unknown id returns `404`; assign to a missing hackathon returns `404` → AC-4, AC-16
- [x] Assign a user with the `ADMIN` role as a judge returns 200 → AC-4
- [x] `GET /hackathon/:id/judges` as author returns items ordered by `assignedAt` then `id`, each with `id`, `userId`, `assignedAt`, and the user `name`; as any other user returns `403` → AC-5
- [x] `DELETE /hackathon/:id/judges/:userId` for a judge with no scores returns 200 with message `Judge removed successfully`; a missing assignment returns `404` → AC-6
- [x] Give the judge one score, then `DELETE` that judge returns `409` and the assignment stays → AC-6
- [x] Publish at least one project, then `GET /hackathon/:id/judging/projects` as the assigned judge returns only `PUBLISHED` projects ordered by `createdAt` then `id`, each with `id`, `title`, `repoUrl`, `status`, and owner `name`; drafts are absent → AC-7
- [x] `GET /hackathon/:id/judging/projects` as the author (not separately assigned) and as the `participant` returns `403` → AC-7
- [x] Before the end date, `PUT /hackathon/:id/projects/:projectId/scores` returns `400` → AC-8, AC-10
- [x] After the end date, `PUT` with a `scores` array that holds every criterion exactly once (each value from 1 to 10) returns 200 with message `Scores submitted successfully` → AC-8
- [x] `PUT` with an empty array, a partial set, a duplicate criterion, an unknown criterion id, a criterion from another hackathon, or a value of `0` or `11` returns `400` → AC-8, AC-10
- [x] `PUT` an unpublished project, a project from another hackathon returns `400`; a missing project returns `404` → AC-8, AC-10
- [x] `PUT` as the `participant` user returns `403` → AC-10
- [x] Resubmit the same values twice and confirm the rows and their `updatedAt` do not change; change one value and confirm only that row changes and no duplicate row appears → AC-9
- [x] `GET /hackathon/:id/projects/:projectId/scores` as the judge returns rows with `criterionId`, `criterionName`, `weight`, `value` for their own scores, plus `total` and `incomplete` → AC-11
- [x] `GET` the same route as the author returns every judge row with `judgeId` added, plus `total` and `incomplete` → AC-11
- [x] `GET` scores as the `participant` returns `403`; for a missing project or a project from another hackathon returns `404` → AC-11
- [x] Use two judges with different value patterns against weights `40` and `60`; confirm each judge weighted score is `(value*weight summed) / 100`, the project `total` is the average of the two, rounded to two decimals, and `incomplete` is `false` once both have a full set → AC-12
- [x] A project with no scores returns `total` `null` and `incomplete` `true` → AC-11
- [x] `POST /hackathon/:id/lock-scoring` before the end date returns `400`; with no criteria or no judges returns `400` → AC-13
- [x] After the end date with at least one criterion and one judge, the first lock returns 200 with message `Scoring locked successfully` and sets `scoringLockedAt`; a second lock returns 200 and leaves the time unchanged → AC-13
- [x] After the lock, `PUT` scores returns `400`, `DELETE` a judge returns `409`, and `POST` a judge returns `409` → AC-6, AC-13
- [x] `DELETE /hackathon/:id` with any criteria, judge, or score returns `409` with one message naming criteria, judges, and scores; the three counts and the delete run in one transaction → AC-14
- [x] `DELETE` a hackathon with no judging data and no projects returns 200 → AC-14
- [x] With a score present, `POST /hackathon/:id/projects/:projectId/unpublish` and `DELETE` the project each return `409`, even after the end date, and the project stays published → AC-15
- [ ] Edit a scored project before the end date returns 200 → AC-15 (not independently testable: scoring opens only after the end date, so a scored project cannot exist before the end date; the update path is not blocked by the score guard)
- [x] A project without scores still returns the existing `400` when unpublished or deleted after the end date → AC-15
- [x] As a judge, `POST /hackathon/:id/join` returns `400` and names the conflict, checked after the missing, inactive, and ended checks and before the duplicate join check → AC-16
- [x] As a participant, `POST /hackathon/:id/judges` returns `400` and names the conflict → AC-16
- [x] Call every route above without a session and confirm each is rejected by `AuthGuard` with `401` or `403`, matching the existing project routes → AC-17

## Commands

- [x] `pnpm build` → exits clean → AC-1 through AC-17
- [x] `pnpm lint` → exits clean → AC-1 through AC-17
- [x] `pnpm exec prisma migrate status` → reports `Database schema is up to date!` → AC-9, AC-12
- [x] `pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` → `No difference detected` → AC-9, AC-12

## Acceptance-criteria coverage

- AC-1 covered by the criterion create steps and their errors · AC-2 by the criteria list steps · AC-3 by the criterion change and freeze steps · AC-4 by the judge assign steps · AC-5 by the judge list step · AC-6 by the judge remove, reassign, and lock steps · AC-7 by the judge project list steps · AC-8 by the score submission steps · AC-9 by the resubmit step · AC-10 by the score window, permission, and foreign criterion steps · AC-11 by the score read steps · AC-12 by the weighted total steps · AC-13 by the lock steps · AC-14 by the hackathon delete steps · AC-15 by the project unpublish and delete steps · AC-16 by the role conflict steps · AC-17 by the no session step
