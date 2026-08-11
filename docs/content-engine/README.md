# Classfully content engine

This folder defines how a scheduled Codex task should research, draft, review, and maintain Classfully Field Notes.

The goal is not to publish the most articles. The goal is to earn attention from university instructors who are likely to create a class and run a live interaction.

## Editorial position

Classfully is the interactive layer for university courses. It works beside an instructor's existing slides and connects attendance, questions, participation, confidence, and progress across every session.

"Mentimeter for classrooms" is useful shorthand for search and comparison content. It is not the full position. The distinction to carry through the library is:

- Presentation-first tools collect responses around a presentation.
- Classfully connects live participation across a class, its sessions, and each student's journey.

Never imply that Classfully replaces an LMS, presentation app, or instructor judgment.

## Audience

Primary reader:

- A university instructor teaching 30 to 200 students
- Uses PowerPoint, Keynote, or Google Slides
- Wants more students to participate without adding classroom chaos
- Has limited preparation time
- Needs a practical reason to adopt another tool

Secondary reader:

- A department lead, learning designer, or teaching innovation lead
- Needs a shared student record, instructor workspaces, privacy controls, and evidence that adoption will be manageable

## Content families

1. Classroom practice
   - Practical activities, timing, facilitation, and large-room management
2. Student participation
   - Questions, discussion, confidence, belonging, and sustainable motivation
3. Course progress
   - Attendance, streaks, reflection, rewards, and change across sessions
4. Tools and comparisons
   - Neutral comparisons built around teaching jobs, not feature-count tables

## Publishing rule

Every generated article remains a draft until a person reviews it. The scheduled task may create a branch or pull request. It must not merge, publish, or deploy by itself.

Draft posts can be opened directly on local and Vercel preview environments. Production returns no article page until the post status changes to `published`.

## Reference implementation

Use these files as the canonical reference:

- Blog index: `src/app/blog/page.tsx`
- Article template: `src/app/blog/[slug]/page.tsx`
- Typed content model: `src/content/blog/types.ts`
- Content calendar: `src/content/blog/content-calendar.ts`
- Reference article: `src/content/blog/posts/interactive-lecture-without-rebuilding-slides.ts`
- Reference visual: `public/images/blog/interactive-lecture-without-rebuilding-slides.webp`

## Definition of a useful article

An article must contain:

- One clear instructor problem
- A specific university classroom context
- A teaching decision the reader can make
- At least one reusable framework, plan, table, or checklist
- Product claims verified against the current application
- A natural path to a relevant Classfully feature or signup
- Original value that would remain useful without the target keyword

Do not create an article when the topic cannot meet these conditions.
