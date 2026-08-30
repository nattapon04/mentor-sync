# MentorSync - Business Requirements Document (BRD)

## 1. Project Overview
**MentorSync** is a platform designed to formalize and gamify the mentorship and performance evaluation process within cross-functional teams (e.g., Engineering, QA, IT). It bridges the gap between daily Jira tasks and long-term skill development.

## 2. Target Audience & Roles
The system supports multiple roles per user. A single user can hold multiple roles simultaneously (e.g., being a Mentor to juniors, while being a Mentee to a senior).
- **Admin**: Manages system users and assigns roles/departments.
- **Mentor (Senior/Lead)**: Configures Service Level Agreements (SLAs), evaluates Mentees based on Jira tickets, awards gamification badges, and provides feedback.
- **Mentee (Junior/Mid)**: Receives feedback, tracks personal performance metrics, and collects badges.
- **Manager (Upcoming)**: Views team-wide reports and aggregated performance.

## 3. Core Features & Business Logic

### 3.1. Dynamic SLA Configuration
- SLAs are performance criteria (e.g., "Zero Production Bugs", "PR Review Time").
- **Scope**: SLAs can be "Global" (applies to all departments) or specific to a "Department" (e.g., Engineering, QA).
- **Metrics**: 
  - *Quality*: Focuses on defect rates and rework.
  - *Velocity*: Focuses on delivery speed and sprint commitment.
  - *Soft Skills*: Focuses on communication, critical thinking, and teamwork.

### 3.2. Ticket-Driven Evaluation
- Instead of monthly subjective reviews, Mentors evaluate Mentees *per Jira Ticket*.
- The evaluation form dynamically loads the SLA rules based on the Mentee's assigned department.
- Mentors can toggle `N/A` for SLAs that do not apply to a specific ticket.
- Values are tracked as `Pass`, `Fail`, or `N/A`.

### 3.3. Gamification & Badges
To encourage positive reinforcement, Mentors can manually award badges for outstanding behavior.
- **Zero Defect Hero**: No bugs found after deployment.
- **One-Shot Sniper**: Feature passed QA on the first attempt.
- **Mastermind**: Excellent architectural design.
- **QA's Best Friend**: Exceptional collaboration with the QA team.
- **Firefighter**: Saved the team from a critical production issue.
- **Sprint Master**: Delivered complex tasks ahead of schedule.

### 3.4. Continuous Feedback (Quick Notes)
- Mentors can drop quick notes categorized as `Positive`, `Neutral`, or `Constructive`.
- This provides an informal channel for feedback without affecting formal SLA scores.

## 4. User Journeys
1. **Admin Setup**: Admin creates users, assigns them to departments (e.g., Engineering), and gives them Mentor/Mentee roles.
2. **SLA Definition**: Mentors define what success looks like for their department.
3. **Daily Operations**: Mentee finishes a Jira ticket. Mentor reviews the PR, goes to MentorSync, inputs the Ticket ID, and marks Pass/Fail for relevant SLAs.
4. **Gamification**: If the Mentee did an exceptionally good job, the Mentor awards a "One-Shot Sniper" badge.
5. **Review**: Mentee logs in, views their Performance Radar chart, and sees their new badge on the "Wall of Achievements".
