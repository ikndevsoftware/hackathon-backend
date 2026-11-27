# 0002. Judging and scoring, decision record

## Context

> Premise note: This feature assumes the existing Better Auth session model, the `ADMIN` and `PARTICIPANT` roles, and the existing `Hackathon`, `HackathonParticipant`, and `Project` tables. Those decisions have no spec. The build must treat them as fixed and add judging without changing them, except for the three explicit guards in the build plan.

The event loop already runs from an organiser creating a hackathon, through a participant joining, to a project being submitted and published. What is missing is the step that turns a submission into a comparable result. Feature 7 will publish winners and ranks, but it cannot do that until scores and a total exist.

The project is a small NestJS API with one hackathon at a time and a participant cap of 100. There is no frontend in this scope, no external judging service, and no new credentials. The judging rules must be enforceable by the API and the database, because a judge and an organiser act at different times and a score can be revised before the window closes.

Two forces shaped the decision. First, scores must stay stable once judging starts, otherwise a total would change meaning after a judge had already scored. Second, the organiser and the judges are different people, so ownership of the rubric and ownership of a score must be separate but scoped to the same event. The current role model has only participants and admins, so adding a global judge role would change account wide behaviour for a single event concern.

The build approach is Tracer Bullet. The first slices must prove the whole path works from a criterion to a saved score to a readable total before the surrounding routes are added.

## Options considered

### Option 1: A per hackathon judge list with explicit criterion and score tables

A `HackathonJudge` row links a user to one event. A `Criterion` row belongs to one event. A `Score` row holds one value for one project, one criterion, and one judge, with a unique key across those three. The author owns the rubric and judge list, and the weighted total is computed on read.

**Pros**:

* Judging is scoped to one event without changing the global role model.
* The unique score key prevents duplicate or conflicting values under concurrent writes.
* A rubric frozen at the end date and a computed total keep past scores meaningful.
* The service can enforce that judge, criterion, and project share a hackathon before writing.

**Cons**:

* Three new tables and a transaction are more surface than a single score table with a global judge flag.
* The author only rule diverges from the existing any admin rule for hackathon edits.
* Full set submission is stricter than saving one criterion at a time.

### Option 2: A global JUDGE role with a simpler score table

Add `JUDGE` to the `Role` enum and let a judge score any published project. No assignment table is needed.

**Pros**:

* Fewer tables and fewer routes for assignment.
* A judge can help across events without being added to each one.

**Cons**:

* A role change affects the whole account, so a judge for one event gains standing everywhere.
* Role promotion and demotion are part of a later feature and are not safe yet.
* It breaks the event scoped ownership that this API uses for hackathons and projects.

### Option 3: A judge flag on the participant row

Reuse `HackathonParticipant` with a boolean that marks judges, and add only `Criterion` and `Score`.

**Pros**:

* One less table and one less join to write.
* Judge and participant membership are visible in one place.

**Cons**:

* A participant cannot be a judge under this design, which is a real rule here, but a flag on the same row makes the conflict hard to express and easy to bypass.
* The row mixes two different meanings, so later queries must always remember the flag.
* It couples judge identity to joining, when a judge does not need to join at all.

### Option 4: Equal weights with a simple average

Skip the weight field and average raw scores across judges.

**Pros**:

* Simplest calculation and simplest DTO.
* Nothing can go stale in a rubric.

**Cons**:

* It contradicts the requirement that criteria carry weights.
* An organiser cannot make an important criterion count for more.
* Results would be harder to explain to participants.

## Rationale

Option 1 is the only design that keeps judging scoped to one event while giving the database a key that prevents duplicate scores. A global judge role would be a wrong fit here because role changes are account wide and the role management feature is not built yet. A participant flag would make the judge and participant conflict a property of one row, which is harder to reason about than two separate memberships that can be checked against each other.

The full set submission is deliberately strict. A judge who must save every criterion in one request cannot leave a half set behind. The rubric freezes when the end date passes, which is before any score can exist. That was chosen over freezing on the first saved score because a score count can fall back to zero when a user is deleted, which would reopen the rubric after judging had started. It also removes a race between a rubric edit and a concurrent score. The cost is that an organiser must finish the rubric before the event ends.

The weighted total uses relative weights and normalises by their sum. That lets an organiser choose 1, 2, 3 or 10, 20, 70 with the same effect, and it avoids a validation rule that forces weights to add to 100. Averaging across judges rather than summing them means inviting more judges does not inflate a project's score. Computing the total on read avoids a stored aggregate that could drift from the rubric, at the cost of a small query on every read. The total is rounded to two decimals and is null until a judge has a full set.

Locking freezes the judge list as well as the score sets. Without that, removing a scoreless judge after the lock would change the denominator of the incomplete flag. The score guard on unpublish and delete runs before the end date check, because scores only exist after the end date and the existing 400 would otherwise make the new 409 unreachable. Delete guards count and delete in one transaction so a new row cannot slip between the check and the delete.

Author only management was chosen over any admin. It is stricter than the current hackathon routes, but it makes the person who created the event accountable for its judging setup. The tradeoff is that another admin cannot rescue a half set up event, and that should be revisited when admin role management is designed.
