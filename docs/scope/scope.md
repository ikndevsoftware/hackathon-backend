# Scope: Hackathon backend

An API for running one hackathon at a time. Organizers create an event, participants join and submit projects, judges score them, and results are published.

**Build approach:** Tracer Bullet (each feature is a narrow, real thread through the whole stack before the next one starts).
**Workflow:** Prototype (just `/develop` and its own build time self check; no verify, test, or review unless you add it per feature). The project default level of rigor. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag (e.g. `· Beta`) to do more.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 1 | Auth and roles | Already built | existing |
| 2 | Hackathon management | Already built | existing |
| 3 | Join flow | Already built | existing |
| 4 | Platform plumbing | Already built | existing |
| 5 | Project submissions | Slice 1 | done |
| 6 | Judging and scoring | Slice 1 | planned |
| 7 | Results and standings | Slice 1 | planned |
| 8 | Admin access and event setup | Slice 2 | planned |
| 9 | Join safeguards and capacity | Slice 2 | planned |
| 10 | Email notifications | Slice 3 | planned |
| 11 | Logging and error tracking | Slice 3 | planned |
| 12 | Launch checks | Slice 3 | planned |

## Already built

### 1. Auth and roles · existing
Email and password sign in, sessions, and the `PARTICIPANT` and `ADMIN` roles. A user cannot set their own role at sign up. code in `src/lib/auth/`

### 2. Hackathon management · existing
Admins create, read, update, and delete hackathons, with validation that the start and end dates are in the future. code in `src/module/hackathon/`

### 3. Join flow · existing
A participant joins an active hackathon once. The endpoint rejects an inactive event, an ended event, and a duplicate join. code in `src/module/hackathon/hackathon.controller.ts`

### 4. Platform plumbing · existing
Prisma access, Arcjet protection, the response wrapper, validation error shaping, and user lookup endpoints. code in `src/lib/`, `src/common/`, and `src/main.ts`

## Slice 1: Core event loop

### 5. Project submissions · done
A joined participant creates one project per hackathon with a title, description, repo link, and demo link, and can edit it until the deadline. This is the first strand of the core loop.
**Done when:** a joined participant can create, edit, and view their project, and an organizer can list every project for the event.
Spec: [0001](../specs/0001-project-submissions/index.md)
code in `src/module/project/`
- [x] Design it (spec): `/architect project submissions`
- [x] Build it: `/develop project submissions`
  - [x] Schema, enum, and DTOs, satisfies AC-1 and AC-11
  - [x] Create and read thread, satisfies AC-1, AC-2, AC-3, AC-4, AC-5, AC-12
  - [x] Admin list and edit, satisfies AC-6 and AC-7
  - [x] Publish, unpublish, delete, satisfies AC-8 and AC-9
  - [x] Hackathon delete block and smoke pass, satisfies AC-10 and AC-1 through AC-12

### 6. Judging and scoring · needs a decision
Organizers define criteria with weights, assign judges, and judges score each project. This closes the loop from a submission to a comparable score.
**Done when:** an organizer sets criteria and judges, a judge scores every project once per criterion, and each project shows a weighted total.
- [ ] Design it (spec): `/architect judging and scoring`

### 7. Results and standings · needs a decision
Organizers publish the final order so participants and organizers see winners and ranks. Results stay hidden until they are published.
**Done when:** an organizer publishes results, participants see their rank and the winners, and nothing is visible before that.
- [ ] Design it (spec): `/architect results and standings`

## Slice 2: Run a real event

### 8. Admin access and event setup · needs a decision
Create the first admin without touching the database by hand, and let admins change roles safely.
**Done when:** a fresh environment gets its first admin with one documented command, and an admin can promote or demote a user without being able to change their own role.
- [ ] Design it (spec): `/architect admin access and event setup`

### 9. Join safeguards and capacity · needs a decision
Enforce the planned participant bounds and the event dates, so a real event fills correctly and no one joins too early or too late.
**Done when:** joining honors the 40 to 100 bounds, a full event returns a clear message, joining before the start is rejected, a participant can leave before the start, and an admin can list participants.
- [ ] Design it (spec): `/architect join safeguards and capacity`

## Slice 3: Communications and operations

### 10. Email notifications · needs a decision
Send the account and event emails a real event needs, so people can verify, reset, and know what is next.
**Done when:** a new user verifies their email, a user resets a password, and participants get a submission confirmation and a results message, with send failures logged.
- [ ] Design it (spec): `/architect email notifications`

### 11. Logging and error tracking · needs a decision
Give every request a structured log and send unexpected errors to a tracker, so problems on event day are visible fast.
**Done when:** errors reach the tracker with request context, and the main flows produce searchable logs without leaking secrets.
- [ ] Design it (spec): `/architect logging and error tracking`

### 12. Launch checks
Close the gaps between a working API and a safe public one before the event.
**Done when:** a missing environment value stops startup, Arcjet runs `LIVE` after the dry run review, CORS and security headers are set, and a health endpoint reports ready.
- [ ] Build it: `/develop launch checks`

## Deferred

Out of scope for this pass, kept so the plan stays honest.

- **Teams**: form teams and submit as a team · needs a decision
- **Announcements**: organizer messages to all participants · needs a decision
- **File uploads**: decks and screenshots with a submission · needs a decision
- **Public event pages**: shareable pages and a results showcase · needs a decision
- **Product analytics**: sign ups, joins, submissions, and judge activity · needs a decision
- **Legal pages**: privacy and terms · needs a decision
- **Accessibility review**: keyboard and screen reader pass · needs a decision
- **Internationalization**: more than one language · needs a decision
- **Payments**: paid organizer plans or a fee per event · needs a decision · GA

## Legend

**The decision box.** A feature that needs a decision has one box whose label ends with `(spec)`. `/architect` ticks it at spec capture and fills in the build, verify, and test boxes. Every other box is an execution box.

**Status.** `planned` means not started. `in-progress` means designed or partly built. `done` means you decided it is finished. `existing` means it predates this plan. `dropped` means it left the plan but stays for history.

**Next step.** The first unticked box.

**Tags.** `needs a decision` means run `/architect` first. An approach tag such as `· Facade` overrides the project default for that feature. A workflow tag such as `· Beta` raises or lowers the rigor for that feature.

**Workflow.** Prototype means `/develop` alone, with its own build time self check. Alpha adds `/check verify`. Beta adds `/test`. GA adds a fresh model `/check review` and `/document`.

**Pointer line.** A spec number and a code path appear once they exist.
