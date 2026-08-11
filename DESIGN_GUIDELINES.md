# Classfully design guidelines

These guidelines define how Classfully should look, sound, and behave across the instructor console, classroom projector, and student phone.

The product is made for university classrooms. It should feel academically credible, quietly playful, and genuinely human. It should never feel like children's software, a corporate analytics dashboard, or a game layered on top of teaching.

## 1. Product personality

Classfully is scholarly, friendly, alive, collective, and calm under pressure.

- It respects the classroom without sounding institutional.
- Warmth comes from language, rhythm, and movement. It does not come from mascots or novelty.
- The interface responds visibly to the class, then settles so the data stays readable.
- Students contribute to a shared picture of the room. There are no public rankings or winners.
- An instructor should understand what is happening in a few seconds while teaching.

The central visual idea is the **class signal**: individual responses arrive as small points and form a clear collective pattern.

## 2. Design principles

### Make the room visible

Show how the class is arriving, understanding, and responding. Preserve exact numbers, but let the collective pattern feel alive.

### Let people participate quietly

Students should be able to respond, ask, or signal the pace without needing to perform publicly.

### Keep the instructor in control

Instructor controls must be easy to find, safe to use while speaking, and clear about what appears on the projector.

### Design for the back row

Anything projected should be understandable from a distance. One main idea per screen, large type, high contrast, and minimal controls.

### Add play through response, not decoration

Playfulness comes from dots arriving, clusters settling, and the room changing together. Avoid decorative animation that competes with the lesson.

## 3. Voice and copy

### Voice

Write as a thoughtful instructor would speak to a class:

- Natural and direct
- Warm without being overly enthusiastic
- Clear enough to understand on the first read
- Inclusive of students who prefer not to speak publicly
- Specific about privacy and what other people can see

Contractions are welcome. Short sentences are better than formal ones. Exclamation marks should be rare.

### Anti-AI-slop boundaries

The copy should sound like a thoughtful person in a classroom, not a product pitch or an AI-generated summary.

- Do not use em dashes. Use a period, comma, colon, or parentheses instead.
- Do not use stock contrast formulas such as “not just X, but Y” or “more than X, it is Y.” State the point directly.
- Do not open with filler such as “In today’s fast-paced world,” “Whether you’re,” or “From X to Y.”
- Do not use vague transformation language. Avoid “unlock,” “elevate,” “reimagine,” “revolutionize,” “empower,” and “transform” unless a concrete change is named.
- Do not describe routine product use as a “journey.” Name the actual task, lesson, response, or result.
- Do not stack three or more adjectives to make a feature sound important.
- Do not use vague superlatives such as “beautiful,” “powerful,” “seamless,” “robust,” “intuitive,” or “world-class” without specific evidence.
- Do not invent statistics, social proof, time savings, outcomes, or reliability claims.
- Do not call something “AI-powered” when the useful behavior can be described plainly.
- Do not use rhetorical questions as headings when a direct heading is clearer.
- Do not add fake excitement. Routine confirmations do not need exclamation marks, confetti, or congratulatory language.
- Do not use emoji as punctuation or as a substitute for a clear icon or label.
- Do not speak for students’ emotions. Describe the response that was given and let the student interpret it.
- Do not repeat the same idea in a heading, subheading, and body paragraph.
- Do not hide uncertainty. If a result is early, incomplete, inferred, or based on few responses, say so.

Read every important line aloud. If it sounds like marketing copy, a press release, or a generic assistant response, rewrite it in the words an instructor would naturally use.

| Avoid | Prefer |
| --- | --- |
| Transform your teaching experience | See the room while you teach |
| Unlock powerful student insights | See where the class needs more time |
| Begin your learning journey | Start the lesson |
| Seamlessly capture real-time sentiment | Ask how the class is feeling |
| Congratulations! Your submission was successful! | Response sent. |
| AI-powered engagement analytics | A summary of class responses |

### Preferred vocabulary

| Use | Meaning |
| --- | --- |
| **Class** | The official course group or session |
| **Room** | The live, collective state of the class |
| **Student** | The participant; avoid “user” in visible copy |
| **Instructor** | The person teaching; use “professor” only when it is actually their title |
| **Pulse** | A quick emotional or comprehension response |
| **Signal** | The aggregate pattern visible to the room |
| **Check-in** | A short prompt at the beginning or during a lesson |
| **Response** | One student's submitted answer |
| **Activity** | A poll, quiz, open response, debate, reflection, or case study |

### Avoid jargon

Avoid words such as:

- engagement metrics
- sentiment capture
- respondents
- initiate
- activate
- facilitate
- leverage
- optimize participation
- real-time data visualization
- learning analytics, unless the audience is explicitly administrative

Prefer ordinary classroom language:

| Avoid | Prefer |
| --- | --- |
| Initiate check-in | Start a check-in |
| Capture student sentiment | See how the class is feeling |
| 148 respondents | 148 students responded |
| Engagement is declining | The room may need a pause |
| Launch engagement activity | Ask the class |
| Awaiting instructor action | Waiting for the next step |
| Submission successful | Pulse sent |
| Display aggregate results | Show class totals |

### Copy by surface

#### Projector

- Write for the entire room and for spoken delivery.
- Use one clear headline, usually 5–12 words.
- Ask human questions: “How are you arriving today?”
- Keep supporting copy to one or two short sentences.
- Never show implementation details, settings language, or private student information.

#### Student phone

- Tell the student what to do next.
- Keep each screen focused on one action.
- Confirm actions immediately: “Pulse sent. Look up. The class signal just changed.”
- Use reassuring privacy language without sounding legalistic.
- Avoid making a student feel monitored or judged.

#### Instructor console

- Use compact, operational language.
- Name the result of an action: “Open classroom display,” “Pause responses,” “Welcome class.”
- Show what students will see before the instructor triggers it.
- Put the most important room signal in plain language: “19 need a pause.”

### Privacy copy

Privacy language must match the real data model.

- Use **private** when the instructor may still have access to an individual record.
- Use **anonymous** only when the identity genuinely cannot be recovered.
- Always explain the projected view precisely.

Preferred pattern:

> Your response stays private. The projector shows class totals only.

### Status and error copy

Status copy should answer two questions: what happened, and what should I do next?

| Situation | Recommended copy |
| --- | --- |
| Waiting | Waiting for the next step. |
| Connected | Connected. That’s it. |
| Response sent | Pulse sent. Look up. The class signal just changed. |
| Responses paused | Responses are paused. The chart is frozen. |
| Projector blocked | The projector window didn’t open. Allow pop-ups, then try again. |
| Connection lost | We lost the classroom connection. Reconnecting now. |
| Finished | You’re ready. Keep this page nearby. |

## 4. Typography

Typography combines an academic display serif with a neutral interface sans serif.

### Font families

```css
--font-display: Georgia, "Times New Roman", serif;
--font-ui: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

- Use the display serif for major questions, stage titles, response labels, and important numbers.
- Use the UI sans serif for navigation, buttons, instructions, metadata, and operational information.
- Do not use handwriting as a general font. Handwritten annotation is an instructor-only accent.

### Type scale

#### Instructor console

| Role | Size | Guidance |
| --- | --- | --- |
| Main lesson question | 38–54px | Serif, regular, tight letter spacing, 1.04 line height |
| Modal or feature title | 28–34px | Serif, regular, 1.05–1.12 line height |
| Section title | 14–18px | Sans, semibold |
| Body | 12–14px | Sans, regular, 1.45–1.6 line height |
| Button | 11–13px | Sans, semibold |
| Eyebrow or metadata | 9–11px | Sans, bold; uppercase only for short labels |

#### Classroom projector

| Role | Size | Guidance |
| --- | --- | --- |
| Main question | 56–104px | Serif, regular, 0.98–1.02 line height |
| Response value | 31–48px | Serif, medium |
| Category label | 18–22px | Serif, regular |
| Supporting copy | 14–18px | Sans, regular, maximum 70 characters per line |
| Eyebrow | 11–13px | Sans, bold, uppercase |

#### Student phone

| Role | Size | Guidance |
| --- | --- | --- |
| Main question | 38–48px | Serif, regular, approximately 1.02 line height |
| Choice label | 17–18px | Serif, regular |
| Body | 14–16px | Sans, regular, approximately 1.55 line height |
| Button | 13–15px | Sans, semibold |
| Metadata | 9–11px | Sans, semibold |

### Typography rules

- Use sentence case for headings and buttons.
- Reserve uppercase for short eyebrows such as “LIVE” or “STEP 2 OF 3.”
- Avoid bold paragraphs. Use weight to establish hierarchy, not emphasis everywhere.
- Do not center long text. Centering is appropriate only for short projector moments and completion screens.
- Keep projector headlines to three lines or fewer.
- Use tabular numerals when values update rapidly or must stay aligned.

## 5. Color system

### Core tokens

| Token | Value | Use |
| --- | --- | --- |
| `paper` | `#FFFEFA` | Primary background; warmer than pure white |
| `surface` | `#FFFFFF` | Cards, inputs, floating controls |
| `ink` | `#101A38` | Headlines, important values, primary text |
| `text` | `#313950` | Standard UI text |
| `muted` | `#697087` | Supporting copy and metadata |
| `line` | `#E3E5ED` | Borders and dividers |
| `soft` | `#F8F7FB` | Secondary surfaces |
| `violet` | `#5146E5` | Primary interaction and active state |
| `violet-soft` | `#F0EFFF` | Selected backgrounds and quiet emphasis |
| `success` | `#3AA45A` | Connected, complete, live confirmation |
| `brand-coral` | `#DF664E` | Small brand accent, including the logo punctuation |

### Pulse colors

These colors must remain stable so students learn their meaning over time.

| Response | Color |
| --- | --- |
| Energized | `#7057E8` |
| Steady | `#2F73DF` |
| A little tired | `#E3B628` |
| Overwhelmed | `#EF7359` |
| Prefer not to say | `#9298A5` |

### Color rules

- Use violet for interaction, not for every decorative element.
- Keep large backgrounds warm and neutral.
- Use full-strength semantic colors on small dots, icons, and key values. Use pale tints for backgrounds.
- Pair every color with a label, value, or position. Never rely on color alone.
- Red and coral should indicate a genuine need for attention, not ordinary negative movement.
- Do not use gradients as general surface decoration. Flat surfaces make the data easier to read and preserve the academic tone.
- Avoid blurred glows, oversized pastel shapes, and decorative dot fields in operational instructor views.
- Every additional layer, tint, or shape must communicate grouping, state, hierarchy, or interaction. Remove it if the screen works the same without it.
- New work should use the canonical tokens above instead of creating near-duplicate grays or purples.

## 6. Layout by surface

### Instructor console: informed and private

- Use a three-part structure: navigation, teaching workspace, live conversation.
- Keep private questions and operational controls off the projector.
- Place persistent lesson controls at the bottom where they can be found while speaking.
- Give the main teaching signal the largest area.
- Preview the projector state so the instructor always knows what students can see.

### Presentation companion mode

The instructor's slides remain in PowerPoint, Keynote, Google Slides, or another presentation tool. Classfully does not require instructors to rebuild or upload their presentation.

- Let the instructor prepare interactions by class and session.
- Keep prepared interactions private until the instructor chooses to show one.
- Open the classroom display once at the beginning of class and keep it ready.
- Make the next prepared interaction reachable from the persistent lesson controls.
- Show the exact projector state in the instructor console before and during an interaction.
- After an interaction, provide one clear “Finish interaction” action and tell the instructor to return to their slides.
- Do not claim that the browser can switch operating-system windows automatically when it cannot.
- Explain the physical switch during onboarding and let the instructor test it before students arrive.
- Always allow an unplanned poll or question without forcing the instructor to edit the session plan.

### Projector: simple and collective

- Show one classroom moment at a time.
- Use generous side margins, approximately 6% of the viewport.
- Keep persistent chrome limited to course identity, connection status, step progress, and join code.
- Avoid scrolling during a live prompt.
- Keep exact counts visible, but secondary to the main question and collective pattern.

### Student phone: one-handed and immediate

- Design first for approximately 390–430px width.
- Use at least 20px horizontal page padding.
- Keep tap targets at least 44px high; response choices should usually be 52–58px high.
- Put the next action within comfortable thumb reach when possible.
- Show immediate selected, disabled, loading, and confirmation states.
- Do not reproduce the instructor dashboard on a small screen.

### Spacing scale

Use a 4px foundation, with these preferred steps:

`4, 8, 12, 16, 24, 32, 48, 64`

- 8–12px: icon and label gaps
- 12–16px: compact controls and card padding
- 20–24px: mobile page padding and component groups
- 32–48px: major sections
- 48–64px: projector composition

## 7. Shape, borders, and elevation

- Dividers: 1px `line`
- Small controls: 8–10px radius
- Cards and inputs: 12–14px radius
- Modals: 18–22px radius
- Pills and status labels: fully rounded
- Use shadows only when an element floats above the teaching surface: modal, onboarding controller, or QR card.
- Avoid heavy shadows, glossy effects, thick borders, and excessive glass effects.

## 8. Components and interaction patterns

### Primary action

- One primary action per moment.
- Violet background, white label, direct verb.
- Examples: “Start class welcome,” “Launch next activity,” “Finish welcome.”

### Secondary action

- White surface, thin border, ink or violet text.
- Examples: “Open display,” “Preview student phone,” “Back.”

### Live status

- Small green dot plus a plain label: “Live,” “Connected,” or “Synced with instructor.”
- Motion should be subtle and must stop under reduced-motion preferences.

### Instructor controller

- Keep active multi-step controls visible until the instructor finishes or exits.
- Always show the current step, progress, and next action.
- Do not force the instructor into a separate setup page during class.

### Waiting state

- Explain what the student should keep open and what will happen next.
- Avoid empty spinners when there is no immediate load in progress.

### Confirmation state

- Confirm the student's action in both text and visual state.
- Connect the phone action to the room: “Look up. The class signal just changed.”

### Interaction taxonomy

Keep the live classroom built on a small number of reliable primitives:

- Pulse: a short scale for wellbeing, confidence, agreement, or pace. Use “Prefer not to say” for personal prompts.
- Opinion poll: one choice with no correct answer. Show the distribution live when it helps open a discussion.
- Knowledge check: one best answer with an explanation. Keep results hidden until the instructor locks responses and reveals the answer.
- Short response: one brief written answer for questions, reflection, or the muddiest point. Keep raw text instructor-only until the instructor explicitly shares an anonymous excerpt.

Reflection is a short-response template, not a separate engine. A case study is a lesson module that contains interactions, not an interaction type. Debate should use poll, discussion, and revote when that workflow is built.

Do not add multiple-select, ranking, matching, word clouds, or timed competition without a recurring classroom use case that the current primitives cannot serve.

## 9. Data visualization

### Magnetic dots are the signature visual

- Each response arrives as a point and settles into the class pattern.
- Keep clusters organic but legible. Variation should communicate aliveness, not uncertainty.
- For small and live classroom counts, prefer one dot per response.
- If dots are aggregated, state the aggregation rule clearly.
- Always show the exact percentage and response count alongside the cluster.

### Comparisons

- Current responses use solid dots.
- Prior classes use quieter outlined dots.
- Keep time labels explicit: “Today,” “Prior class,” or a specific date.
- Do not animate comparison data until the instructor deliberately chooses “Play trend.”

### What not to do

- Do not replace exact values with a decorative world or 3D scene.
- Do not use Three.js for core classroom decisions or live sentiment data.
- Do not turn wellbeing data into a score, competition, or leaderboard.
- Do not make distressed or overwhelmed responses feel like failure.

Immersive or three-dimensional experiences may be explored as optional celebrations or lesson modules, but never as the only way to understand live classroom data.

## 10. Motion

Motion has three jobs:

1. Show that a new response arrived.
2. Show that the class pattern changed.
3. Clarify a transition between lesson states.

Recommended timing:

| Motion | Duration |
| --- | --- |
| Hover or pressed state | 120–180ms |
| Modal or panel entrance | 180–280ms |
| Dot settling | 500–700ms |
| Response arrival trail | 700–1,100ms |
| Trend playback step | 1,200–1,800ms |

Rules:

- The resting state must always be easy to read.
- Use looping motion only for a small live or connection indicator.
- Do not animate every data point when only one value changed.
- Respect `prefers-reduced-motion` and preserve every interaction without animation.

### Signal to field

Use the Classfully response transfer as the shared motion language across student submissions:

1. **Yield:** the real response control keeps its layout and focus state, but its visible surface temporarily disappears. Never leave a duplicate control underneath the animation.
2. **Condense:** an animated copy begins at the exact source bounds, retains the action label briefly, and folds into a small colored signal.
3. **Travel:** the signal follows one curved path toward the top edge. Keep the trail narrow and quiet. Do not add extra particles that compete with the destination.
4. **Impact:** the top edge responds only as the signal approaches. Contact triggers the color wave, surface ripple, success message, and haptic feedback together.
5. **Recover:** restore the source quickly when sending fails. After success, restore it when the effect ends unless the interface has already moved to its submitted state.
6. **Settle:** the projector or class field receives the new response without restarting existing data.

This is an earned effect. Use it when a student sends something into the shared classroom, including a pulse, poll answer, quiz answer, written response, word, or team response. Do not use it for navigation, opening a panel, changing a private draft, timers, or passive projector updates.

The phone and projector should feel connected, but they do not need synchronized choreography. Network timing varies. Confirm the phone action immediately, then let the projector reflect the shared class total when it arrives.

### Motion hierarchy

- Use one-shot movement for taps, saved responses, upvotes, new totals, and answer reveals.
- Use slow breathing movement only for an atmospheric waiting layer. Never breathe, bounce, or reshape the data itself continuously.
- Keep correct-answer motion restrained. A brief halo is enough. Do not use confetti or celebration language.
- Re-key only the value or signal that changed. A new response should not restart the whole chart.
- Color supports grouping. Labels, exact counts, and percentages carry the meaning.

## 11. Accessibility and trust

- Maintain WCAG AA contrast for UI text and controls.
- Use visible keyboard focus states on every interactive element.
- Use semantic buttons, headings, dialogs, radio groups, and status regions.
- Do not communicate meaning through color alone.
- Keep projected text readable under ordinary classroom lighting.
- Make privacy statements accurate and easy to find.
- Never expose an individual student's wellbeing response on the projector.
- Avoid public streaks, rankings, or participation pressure.
- Provide “Prefer not to say” when a prompt is personal.

## 12. Distinctive personality

The product should be recognizable without becoming theatrical.

Use:

- Warm paper instead of sterile white
- Academic serif questions and large numbers
- Organic response clusters
- Short handwritten instructor annotations, only where they add teaching context
- Restrained violet interaction color
- Calm, conversational copy
- Small moments where the room visibly forms together

Avoid:

- Cartoon characters, confetti after routine actions, or children's-game language
- Corporate dashboards full of widgets
- Neon gradients and glass panels everywhere
- Emoji as interface icons
- Overly clever labels that hide what a control does
- Decorative 3D that makes the data harder to understand
- Reward systems that shame quiet or absent students

## 13. Canonical CSS tokens

New live-classroom work should begin with these tokens:

```css
:root {
  --seminar-font-display: Georgia, "Times New Roman", serif;
  --seminar-font-ui: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

  --seminar-paper: #fffefa;
  --seminar-surface: #ffffff;
  --seminar-ink: #101a38;
  --seminar-text: #313950;
  --seminar-muted: #697087;
  --seminar-line: #e3e5ed;
  --seminar-soft: #f8f7fb;

  --seminar-violet: #5146e5;
  --seminar-violet-soft: #f0efff;
  --seminar-success: #3aa45a;
  --seminar-brand-coral: #df664e;

  --pulse-energized: #7057e8;
  --pulse-steady: #2f73df;
  --pulse-tired: #e3b628;
  --pulse-overwhelmed: #ef7359;
  --pulse-private: #9298a5;
}
```

The current prototypes contain a number of near-duplicate neutral colors. Do not add more. Consolidate them into these tokens gradually whenever a related component is edited.

## 14. Review checklist

Before shipping a new screen or component, ask:

- Can an instructor understand this while speaking?
- Can a student understand the next action immediately?
- Can the projector screen be read from the back row?
- Is the language natural when spoken aloud?
- Have we used “student,” “class,” and “room” instead of software jargon?
- Is privacy described accurately?
- Is there one clear primary action?
- Does motion help explain a change?
- Are exact values still easy to read?
- Does the design feel scholarly, friendly, and alive without feeling childish?
- Does the copy avoid em dashes, stock AI phrasing, vague claims, and fake enthusiasm?
- Does it still work with reduced motion and without relying on color alone?

## 15. Live classroom data boundaries

Design the instructor, projector, and student views as three different privacy surfaces.

- The instructor may see raw written responses and individual wellbeing records when the product clearly says so.
- The projector receives totals, distributions, and only the one response the instructor chooses to share.
- Student devices receive the current prompt, their own submission state, and the same safe class-level result shown on the projector.
- Hidden quiz answers and explanations stay in the instructor lesson plan until reveal.
- Join links use a sanitized live-class record. They must never load the full instructor lesson plan.
- Use one response record per anonymous student identity and interaction run, so refreshes and retries do not inflate totals.
- Ending a session must close student writes as well as update the dashboard label.

When a design needs data outside these boundaries, stop and review the privacy promise before implementing it.
