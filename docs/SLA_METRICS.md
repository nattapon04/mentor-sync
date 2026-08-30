# MentorSync — SLA Metric Definitions

This document explains every default `SLARule` seeded in [`backend/database/database.go`](../backend/database/database.go), what it measures, which evaluation type it applies to (`ticket`, `sprint`, or `both` — see `eval_type` on `SLARule`), and the exact criteria a Mentor should use to mark `Pass` / `Fail` / `N/A` when filling out an evaluation.

All rules below are seeded with `Scope: "Engineering"`. Admins can clone/adjust them per department from the **SLA Config** page (`/criteria`), including changing `Applies To` (ticket/sprint/both).

## Quality — Ticket-level

### Self-Verification (การตรวจสอบด้วยตัวเอง)
- **Applies to**: Ticket
- **Target**: 100%
- **What it measures**: Whether the developer tested their own change (manual test, unit test, or local verification) *before* handing it off for review, instead of relying entirely on QA/reviewer to catch problems.
- **Pass**: Developer can show evidence of self-testing (test steps in the PR description, a passing test added, a recorded screen capture, etc.).
- **Fail**: No self-verification evidence, or the reviewer/QA found a defect that basic self-testing would have caught.
- **N/A**: Ticket has no testable behavior (e.g., pure documentation/config change).

### Code Review Rework (จำนวนรอบการแก้โค้ดที่รีวิว)
- **Applies to**: Ticket
- **Target**: ≤ 2 rounds/PR
- **What it measures**: How many review-and-fix cycles a PR takes before approval. Counts "requested changes" cycles on the PR, not simple nitpick comments.
- **Pass**: PR approved within 2 review rounds.
- **Fail**: 3+ rounds of requested changes.
- **Data source**: PR review history in GitHub/GitLab/Bitbucket, entered manually by the Mentor.

### Production Escape Bugs (บั๊กที่หลุดไปโปรดักชัน)
- **Applies to**: Ticket
- **Target**: 0 Bugs
- **What it measures**: Whether the change shipped by this ticket caused a bug reported in production.
- **Pass**: No production incident/bug ticket linked back to this ticket within the tracking window (recommend 14 days after release).
- **Fail**: Any linked production bug, regardless of severity.
- **Data source**: Linked "caused by" ticket in Jira, or incident postmortem reference.

### First-Time-Right Rate (อัตราผ่านโดยไม่ต้องแก้ไขซ้ำ) — *new*
- **Applies to**: Ticket
- **Target**: 0 Reopens
- **What it measures**: Whether the ticket stayed closed after being marked Done — i.e., it didn't come back due to incomplete work, missed edge cases, or misunderstood requirements. This is deliberately measured *after* the ticket is closed, which is what separates it from *Code Review Rework* (measured *before* merge, at the PR stage).
- **Pass**: Ticket has not been reopened within 7 calendar days of moving to Done.
- **Fail**: Ticket reopened within that window for any reason attributable to the implementation (bug, missed AC, incomplete work).
- **Exclusion**: Reopens caused purely by a *new* requirement or scope change (not a defect in the original work) don't count as a fail — use `N/A` and note it in the comment.
- **Data source**: Jira status-change history (Done → reopened transitions).

### Documentation Completeness (ความครบถ้วนของเอกสารประกอบงาน) — *new*
- **Applies to**: Ticket
- **Target**: 100%
- **What it measures**: Whether the ticket left behind enough written context for the next person (teammate, future maintainer, or the mentee's future self) to understand *what* changed and *why*, without re-reading the whole diff.
- **Checklist (all 3 required to Pass)**:
  1. PR description explains **what** changed and **why** (not just "fixes bug").
  2. Non-obvious code (workarounds, tricky logic, business-rule exceptions) has an inline comment explaining the reasoning.
  3. README / CHANGELOG / API doc updated if the change affects public behavior, config, or an external contract.
- **Pass**: All 3 checklist items satisfied.
- **Fail**: Any missing item on a ticket where it was applicable.
- **N/A**: Ticket has no public-facing or non-obvious surface (e.g., a one-line trivial fix) — use judgment, and log the reason in the comment field.

## Velocity — Ticket-level

### Ticket Cycle Time (ระยะเวลาทำทิกเก็ต)
- **Applies to**: Ticket
- **Target**: ≤ 3 days
- **What it measures**: Elapsed time from "In Progress" to "Done", i.e. how long active work took (not queue time).
- **Pass**: Cycle time ≤ 3 working days.
- **Fail**: Longer, unless justified by ticket complexity (Mentor discretion + comment).
- **Data source**: Jira status timestamps.

### Time-to-First-Response (ระยะเวลาตอบสนองงานแรก) — *new*
- **Applies to**: Ticket
- **Target**: ≤ 4 hours (working hours only)
- **What it measures**: How long a ticket sits untouched after being assigned before the mentee actually starts on it (first status transition to "In Progress", first commit, or first meaningful comment — whichever comes first). Catches tickets that quietly age in a backlog.
- **Pass**: First-response time ≤ 4 working hours from assignment.
- **Fail**: Longer, with no acknowledgement/blocker noted.
- **How to record**: Log the actual elapsed hours in `value_numeric` (even when it passes) so the trend is visible on the mentee's performance chart, and use `value_string` for Pass/Fail against the 4h target.

## Velocity / Soft Skill — Sprint-level

### Sprint Commitment (ความสำเร็จตามสปริ้นท์)
- **Applies to**: Sprint
- **Target**: ≥ 85%
- **What it measures**: % of committed story points/tickets actually completed by sprint end (excludes items removed from scope by the team before day 2 of the sprint).
- **Pass**: ≥ 85% of committed points delivered.
- **Fail**: Below 85%, unless caused by an external blocker (note in comment; Mentor discretion on Pass/Fail in that case).

### Estimation Accuracy (ความแม่นยำของการประเมิน Story Point) — *new*
- **Applies to**: Sprint
- **Target**: ≤ 20% variance
- **What it measures**: How close the mentee's own estimates were to actual effort across the sprint's tickets — a different question from *Sprint Commitment* ("did you finish what you promised?") vs. estimation accuracy ("was your promise realistic in the first place?").
- **Formula**: `avg(|actual_time − estimated_time| / estimated_time)` across the mentee's tickets closed in the sprint.
- **Pass**: Average variance ≤ 20%.
- **Fail**: Average variance > 20%.
- **How to record**: Put the computed variance % in `value_numeric` so it can be tracked sprint-over-sprint; a mentee should trend downward (more accurate) over time, not just pass/fail once.

### Peer Code Reviews (การรีวิวโค้ดให้เพื่อน)
- **Applies to**: Sprint
- **Target**: ≥ 5 PRs/Sprint
- **What it measures**: Whether the mentee is actively reviewing teammates' code (not just receiving reviews), as a proxy for engagement with the team's overall quality.
- **Pass**: ≥ 5 PRs reviewed (substantive review, not a rubber-stamp approval) in the sprint.
- **Fail**: Fewer than 5.

### Knowledge Sharing (การแบ่งปันความรู้ในทีม) — *new*
- **Applies to**: Sprint
- **Target**: ≥ 1 time/sprint
- **What it measures**: Whether the mentee actively transferred knowledge to the team, beyond just doing their own tickets — e.g. a tech talk, an internal wiki/doc write-up, a recorded pairing session, or leading a walkthrough of a tricky piece of code.
- **Pass**: At least one identifiable knowledge-sharing activity happened in the sprint, with a reference (Slack post, wiki link, calendar invite, meeting notes).
- **Fail**: None occurred.
- **Note**: This is intentionally separate from *Peer Code Reviews* — reviewing a PR is reactive quality control, this metric is about proactively teaching.

### Standup/Ceremony Participation (การเข้าร่วมกิจกรรม Scrum) — *new*
- **Applies to**: Sprint
- **Target**: ≥ 90% attendance
- **What it measures**: Attendance and engagement (not just presence) in standups, planning, and retro for the sprint. Measured at the sprint level (not per-ticket) because ceremonies happen on a sprint cadence, not a per-ticket one.
- **Pass**: Attended ≥ 90% of scheduled ceremonies, actively updated status (not silent/AFK).
- **Fail**: Missed more than 10% without a pre-notified reason (leave, meeting conflict, etc. are excused — track those as `N/A` days, not absences).

## Soft Skill — Applies to Both (Ticket and Sprint)

### Critical Thinking (การคิดเชิงวิพากษ์)
- **Applies to**: Both
- **Target**: ≥ 4/5
- **What it measures**: Whether the mentee questioned assumptions, spotted edge cases, or pushed back on an unclear/risky requirement rather than implementing blindly. Scored subjectively by the Mentor on a 1–5 scale, evaluated either against a specific ticket's decisions or the mentee's general behavior across the sprint.
- **Scoring guide**: 5 = proactively identified a risk/edge case the Mentor hadn't considered; 3 = asked reasonable clarifying questions; 1 = implemented without questioning an obviously ambiguous spec.

### Support & Investigate (การซัพพอร์ตและตรวจสอบ)
- **Applies to**: Both
- **Target**: ≥ 4/5
- **What it measures**: Willingness and effectiveness in helping investigate incidents/support requests (own or teammates'), whether tied to a specific ticket or general sprint behavior. Scored 1–5 by the Mentor.
- **Scoring guide**: 5 = drove an investigation to root cause independently; 3 = helped when asked and followed through; 1 = avoided or deflected support/investigation work.

---

## Adding a new metric

1. Go to **SLA Config** (`/criteria`) as an Admin/Mentor.
2. Fill in **Rule Name**, **Metric Type** (`quality` / `velocity` / `soft_skill`), **Applies To** (`ticket` / `sprint` / `both`), **Operator & Target**, and **Department Scope** (`global` or a specific department).
3. Add a row to this document describing the exact Pass/Fail criteria — an SLA without a written measurement rule is not enforceable, it's just a suggestion.
