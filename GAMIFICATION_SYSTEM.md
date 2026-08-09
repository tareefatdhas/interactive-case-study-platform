# Classfully gamification system

## Purpose

Gamification should make participation feel worthwhile across a semester without turning the classroom into a noisy competition. Students should always understand why they earned something, what it is worth, and whether it affects their grade.

The system has two balances:

- **Class score** tracks instructor-marked academic work such as correct quiz answers.
- **Seminar points** reward participation, preparation, prediction, reflection, and consistency. Seminar points can be exchanged for instructor-approved rewards.

Keeping these balances separate prevents a popular prediction, quick response, or attendance mechanic from silently becoming an academic grade.

## Version one mechanics

### Attendance and consistency

| Event | Default | Notes |
| --- | ---: | --- |
| Join a scheduled class | 5 seminar points | Award once per session after the instructor confirms attendance. |
| Attend consecutive scheduled classes | 2 point consistency bonus | Uses class meetings, not calendar days. |
| Four-class run | 10 point milestone | One grace absence per term protects students with legitimate conflicts. |

The product should say **class run**, not daily streak. It should never reset with a dramatic failure state. A missed class pauses progress unless the instructor marks the absence excused.

### Correct quiz answers

| Event | Default | Notes |
| --- | ---: | --- |
| Submit a quiz response | 2 seminar points | Rewards taking part, even when the answer is wrong. |
| Correct answer | 8 class-score points | Instructor may set the value per quiz. |
| Correct after a confidence check | No extra correctness points | Confidence is for reflection, not grading. |

The result view must show the two awards separately, for example: **+8 class score** and **+2 seminar points**.

### Predicting the class response

| Event | Default | Notes |
| --- | ---: | --- |
| Make a private prediction before reveal | 1 seminar point | Rewards committing to a prediction. |
| Prediction matches the final plurality | 3 seminar points | Called a **room read**, not a correct answer. |

Prediction points never affect the class score. Ties award the match bonus for any tied leading option. Predictions are locked when results are revealed.

### Other classroom activities

| Activity | Default | Limit |
| --- | ---: | --- |
| Poll response | 2 seminar points | Once per prompt |
| Pulse or wellbeing check-in | 1 seminar point | First check-in per session only |
| Open response | 3 seminar points | Once per prompt; no automated quality score |
| Ask a question | 3 seminar points | First two questions per session |
| Upvote a question | 1 seminar point | First three upvotes per session |
| Post-class reflection | 5 seminar points | Once per session |
| Instructor recognizes a useful contribution | 5 seminar points | Manual, named reason, visible in the audit trail |

Points for open responses are based on completion, not word count. This avoids rewarding filler or penalizing concise answers.

## Leaderboards

Leaderboards are available, but they are designed to motivate without publicly exposing grades.

- Students choose a course alias or use an automatically generated one.
- The default view is weekly seminar points, not class score.
- Students see the top five, their own position, and nearby positions.
- The instructor can turn the leaderboard off for a course or hide it for a session.
- Ties share a position.
- Weekly boards reset, while the course total remains visible privately.
- No leaderboard is shown until at least ten students have earned points.
- Wellbeing responses, accommodations, absences, and class scores never appear on a public board.

Recommended secondary boards can recognize different forms of participation without adding more currencies:

- **Room readers** for successful private predictions
- **Question raisers** for questions the instructor chose to discuss
- **Steady contributors** for participating across different activity types

These rotate by week. The product should not show all of them at once.

## Rewards

Instructors create a small course reward shelf. Every reward has a point cost, availability, expiry, approval rule, and usage limit.

Recommended reward types:

| Reward | Suggested cost | Guardrail |
| --- | ---: | --- |
| One-day deadline pass | 120 | Not valid on exams or group work; maximum two per term |
| Replace one low-stakes participation miss | 90 | Does not replace required assessments |
| Choose a case or discussion example | 70 | No grade impact |
| Submit one quiz correction | 100 | Student still completes the learning work |
| Small extra-credit token | 150 | Instructor sets a transparent course-wide cap |

Extra credit should be opt-in for the instructor, capped for the entire course, and stated in the syllabus. Redeeming a reward creates a request. It does not change a grade automatically. The instructor approves it and the system keeps a record.

## Student experience

### Immediately after responding

The response confirmation reveals an award only after the response is safely saved.

- A small point trace travels into the student balance.
- The reason is explicit: **Poll response +2** or **Room read +3**.
- Quiz results keep class score and seminar points visually separate.
- A student can continue into the waiting activity without dismissing a modal.
- Reduced-motion mode replaces the trace with a quiet number update.

### Between activities

The normal classroom state shows one compact course-status card:

- current seminar-point balance
- current class run
- progress toward one chosen reward
- a link to the weekly board

The live prompt remains the dominant content. Gamification should never compete with the question.

### Across the semester

The persistent student account includes:

- point history with a plain-language reason for every change
- private class score by session
- current and longest class run
- leaderboard alias and privacy settings
- available and redeemed rewards
- a record of questions, predictions, and reflections worth revisiting

## Instructor controls

Each course starts from a sensible preset. The instructor can change it before the first session.

- Enable or disable seminar points
- Set point values within safe ranges
- Choose which activities earn points
- Enable aliases and leaderboards
- Configure reward inventory and limits
- Mark excused absences
- Review and approve redemption requests
- Export the point ledger and reward history

The interaction composer shows the points beside each prepared question. An instructor should not need to open a separate gamification screen while teaching.

## Integrity and fairness

- Point awards are calculated by a trusted backend, not by the student browser.
- Each award has a unique event key so refreshing or resubmitting cannot duplicate it.
- Predictions are timestamped and locked before the reveal.
- Attendance requires meaningful presence, not merely opening the join URL.
- Manual adjustments require a reason and remain in the audit log.
- Students can see their own complete ledger and report a problem.
- Course staff can reverse an award without deleting the original record.
- Public boards use seminar points only.

## Data model

The existing `StudentProgress`, achievement, grade-bonus, and leaderboard code should be migrated into a single course-scoped ledger instead of extended independently.

Core records:

- `courseRewardSettings`: point values, leaderboard policy, grace rules, and grade cap
- `studentCourseWallet`: seminar balance, class-score total, class run, and alias
- `pointLedger`: immutable awards, reversals, reason, source event, and staff actor
- `rewardCatalog`: cost, inventory, policy, and expiry
- `rewardRedemptions`: requested, approved, declined, or applied state

The wallet is a cached summary. The ledger is the source of truth.

## First build slice

1. Add a course reward preset to instructor setup.
2. Award seminar points for attendance, poll response, quiz participation, open response, and private prediction.
3. Award class-score points for correct quizzes.
4. Show the result award and compact balance on the student live screen.
5. Add the weekly alias leaderboard.
6. Add a two-reward shelf with an approval flow.
7. Test one complete live session from instructor launch through student response, reveal, point award, leaderboard update, and redemption request.

## Acceptance checks

- Reopening the student account on another device shows the same balance.
- Submitting or refreshing twice never duplicates an award.
- A quiz reveals separate class-score and seminar-point changes.
- A prediction submitted after reveal cannot earn points.
- A tied class prediction awards every tied leading option.
- Excused absences do not break a class run.
- A leaderboard never exposes class scores or wellbeing data.
- A reward cannot be applied without instructor approval.
- Turning gamification off leaves the live lesson flow complete and uncluttered.
