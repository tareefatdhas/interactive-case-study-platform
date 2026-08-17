# Classfully Course Momentum

Course Momentum is Classfully's motivation system for university classrooms. It is designed to make useful participation visible without turning a class into an arcade or making quieter students feel exposed.

## The behavior we want

The system reinforces four behaviors:

1. **Participate**: arrive, answer, reflect, and contribute to group work.
2. **Master**: answer knowledge checks correctly or improve after peer discussion.
3. **Contribute**: ask a useful question, support a classmate's question, or help a team submit.
4. **Continue**: return for the next class and build a class run.

The design follows self-determination theory:

- **Autonomy**: students choose their Signal avatar, public alias, and whether they appear on an individual board.
- **Competence**: progress is shown against the student's own course record before it is compared with anyone else.
- **Relatedness**: the projector celebrates shared and team progress. It never spotlights the bottom of a ranking.

## The contract

Points are a record of meaningful participation. Class score is a separate record of demonstrated understanding.

| Event | Points | Class score | Why |
| --- | ---: | ---: | --- |
| Personal pulse or wellbeing check | 0 | 0 | Sensitive check-ins should never be gamed. |
| Poll, word cloud, or peer response | 2 | 0 | Rewards taking part without rewarding a particular opinion. |
| Short response or reflection | 3 | 0 | Recognizes the additional effort of composing a thought. |
| Group submission | 5 | 0 | Reinforces collective completion, once per student in the group. |
| Useful question asked | 1 | 0 | Makes curiosity a valid classroom contribution. |
| Question supported by classmates | 2 to 3 | 0 | Rewards usefulness, with one claim per threshold. |
| Private room prediction | 1 | 0 | Encourages retrieval and metacognition without public judgment. |
| Compare prediction with result | 3 | 0 | Reinforces reflection, not guessing correctly. |
| Correct knowledge check | 2 participation points | 8 | Keeps participation and mastery legible. |
| Improved answer after peer discussion | 2 participation points | 6 | Rewards learning from peers. |

There are no speed bonuses. Speed disadvantages students who use assistive technology, read in a second language, or think deliberately. Timers may structure an activity, but never change its score.

## Public and private surfaces

| Surface | Default | Optional |
| --- | --- | --- |
| Student phone | Personal course momentum, class run, Signal avatar, nearby standing | Full alias leaderboard if the student opts in and the instructor publishes it |
| Instructor console | Individual and team participation diagnostics | Publish a collective, team, or alias moment |
| Classroom display | Shared goal and class momentum | Team standings or top opted-in aliases |

Individual names, student numbers, wellbeing answers, and the bottom of a leaderboard never appear on the projector.

## Fair leaderboards

The default student standing is a **neighborhood**, not a full leaderboard. It shows the student and a few nearby positions while masking classmates who have not chosen to share an alias. This gives orientation without making rank the purpose of the class.

Team standings use average contribution per participating member, with a minimum participation threshold. Raw team totals are not used because a larger team should not win simply by being larger.

Instructors choose one of four visibility modes:

- **Private progress**: no public board.
- **Personal neighborhood**: each student sees only their local position.
- **Team board**: team aliases and normalized momentum may be shown.
- **Alias board**: opted-in student aliases may be shown.

## Signal avatars

A Signal is a small, student-designed course identity. Students choose:

- form
- color family
- face
- orbit accent
- public alias

The editor uses Three.js because depth, lighting, and direct manipulation make authorship feel tangible. Lists and classroom views render a lightweight static version. This avoids opening dozens of WebGL canvases and keeps a 200-person class reliable.

Signals are available from the beginning. They are not purchased or locked behind points.

## Presentation moments

Projector moments are short, instructor-triggered visual summaries:

- **Room momentum**: each valid response creates a ripple and advances a shared goal.
- **Team lift**: team Signals settle into lanes using normalized team momentum.
- **Learning turn**: after peer learning, the display shows how many students reconsidered or improved without identifying them.
- **Class run**: the room celebrates the number of returning participants, not absences.

Every moment has a reduced-motion version and a static fallback. Animation communicates a real event. It is never an idle screensaver.

## Safeguards

- No points for wellbeing, confidence level, or choosing a socially desirable answer.
- No reward for speed.
- No public bottom rank.
- No raw student number in leaderboard or avatar documents.
- No public individual board without both instructor publication and student opt-in.
- One server-validated claim per event.
- Instructor can disable points, boards, avatars, rewards, or projector moments independently.
- Course rewards remain instructor-approved and must comply with institutional policy.

## Success measures

We should judge Course Momentum by classroom behavior, not screen time:

- percentage of joined students who respond at least once
- response coverage across the session
- repeat participation across classes
- second-answer improvement after peer learning
- questions asked and supported
- distribution of participation across students and teams
- student opt-out rate and perceived pressure

Run an instructor-controlled pilot with one class using private progress only and another using collective plus team moments. Compare participation distribution and student-reported pressure before enabling individual boards broadly.
