import type { BlogPost } from '../types';

export const engage100StudentsInALecture: BlogPost = {
  status: 'published',
  slug: 'engage-100-students-in-a-lecture',
  title: 'How to engage 100 students without losing control of the lecture',
  description:
    'A practical large-lecture routine for live questions, polling, peer discussion, pacing signals, and a calm return to teaching.',
  dek: 'A large room does not need more noise. It needs a few clear ways for students to respond, a visible routine, and an instructor who can close each loop.',
  category: 'Classroom practice',
  tags: ['Large lectures', 'Classroom management', 'Student questions'],
  publishedAt: '2026-08-17',
  readingMinutes: 10,
  author: {
    name: 'Tareef Jafferi',
    role: 'Founder of Classfully and university instructor',
  },
  featuredImage: '/images/blog/engage-100-students-in-a-lecture.webp',
  featuredImageAlt:
    'A university instructor reading grouped response signals from students across a large lecture hall',
  primaryKeyword: 'how to engage students in large lectures',
  secondaryKeywords: [
    'large lecture student engagement',
    'interactive activities for large classes',
    'manage questions in a large lecture',
  ],
  signal: {
    problem: 'A large room can look settled while many students are lost.',
    classroomMoment: 'Collect one clear signal, then decide what the room needs.',
    nextSession: 'Keep the pattern so the next class starts better informed.',
  },
  takeaway:
    'Give each kind of student input one clear route. Use a short response loop: ask, wait, read the pattern, act, and close. Three to five planned interactions are usually enough for a 50-minute lecture.',
  sections: [
    {
      id: 'make-participation-legible',
      eyebrow: 'The direct answer',
      title: 'Make participation easy to read',
      blocks: [
        {
          type: 'paragraph',
          text: 'The problem in a 100-student lecture is not a lack of possible activities. It is the cost of collecting input, deciding what matters, and returning everyone to the lesson.',
        },
        {
          type: 'paragraph',
          text: 'Use a small number of repeatable interactions and tell students what each one is for. A pace signal asks whether to slow down. A knowledge check tests one important idea. A question queue collects what needs discussion. A short reflection tells you what should carry into the next session.',
        },
        {
          type: 'callout',
          eyebrow: 'The operating rule',
          title: 'One channel for each job',
          body: 'Do not ask students to decide whether a thought belongs in chat, email, a poll, or a raised hand. Give every kind of input one obvious home.',
          tone: 'sun',
        },
        {
          type: 'cta',
          eyebrow: 'Prepare the room',
          title: 'Build the interaction flow beside your slides',
          body: 'Classfully gives the instructor a console, a separate classroom display, and a phone-friendly student view.',
          label: 'Create an interactive class',
          href: '/signup',
          tone: 'violet',
        },
      ],
    },
    {
      id: 'use-one-response-loop',
      eyebrow: 'Classroom control',
      title: 'Use the same response loop every time',
      blocks: [
        {
          type: 'paragraph',
          text: 'A routine makes interaction feel like part of the lecture instead of an interruption. Students learn when to look at their phones, when to look up, and what happens after the result appears.',
        },
        {
          type: 'steps',
          items: [
            {
              title: 'Ask',
              body: 'Put one answerable question on the projector. Say what students should do and how long they have.',
            },
            {
              title: 'Wait',
              body: 'Give the room enough time to think. Do not narrate every second or call on the first raised hand.',
            },
            {
              title: 'Read the pattern',
              body: 'Look for a split, a dominant answer, a confidence gap, or a question shared by many students.',
            },
            {
              title: 'Act',
              body: 'Choose the next teaching move: continue, give another example, start peer discussion, or discuss one student question.',
            },
            {
              title: 'Close',
              body: 'Explain what the response changed, then clearly return attention to the lecture.',
            },
          ],
        },
      ],
    },
    {
      id: 'a-50-minute-large-lecture-plan',
      eyebrow: 'A practical rhythm',
      title: 'A 50-minute plan for a large lecture',
      blocks: [
        {
          type: 'paragraph',
          text: 'Cornell recommends regular understanding checks in large courses and suggests limiting polling to a small number of meaningful questions. The schedule below uses four response moments. Each has a different job.',
        },
        {
          type: 'table',
          caption: 'Example large-lecture flow',
          headers: ['Time', 'What students do', 'What the instructor watches', 'Next move'],
          rows: [
            ['0–3 min', 'Arrival check-in', 'Attendance and readiness', 'Name the room’s starting point'],
            ['14–17 min', 'Answer one concept question', 'Correctness and confidence', 'Continue or explain again'],
            ['28–34 min', 'Discuss with a neighbour, then answer again', 'How the distribution shifts', 'Discuss the reasoning behind each answer'],
            ['45–49 min', 'Upvote questions and send one exit response', 'Shared questions and unresolved ideas', 'Choose what opens the next class'],
          ],
        },
        {
          type: 'paragraph',
          text: 'Keep optional questions ready, but do not play them simply because they are in the plan. An unused activity should not count against student participation.',
        },
      ],
    },
    {
      id: 'manage-a-question-queue',
      eyebrow: 'Questions at scale',
      title: 'Let the room help set the question order',
      blocks: [
        {
          type: 'paragraph',
          text: 'A stream of 40 questions is not a useful teaching interface. Let students upvote questions they also want answered, then give the instructor controls to discuss, dismiss, or hold a question for later.',
        },
        {
          type: 'list',
          items: [
            'Keep student names off the projector unless there is a clear teaching reason to show them.',
            'Sort by shared interest, but keep unanswered questions easy to find.',
            'Show one question at a time when the class discusses it.',
            'Say when a useful question will be answered later, then carry it into the course record.',
            'Close the queue with a clear return to the lesson.',
          ],
        },
        {
          type: 'callout',
          eyebrow: 'A fair participation rule',
          title: 'Reward contribution, not volume',
          body: 'Points should recognise a useful question and genuine class support. They should not encourage students to post repeatedly or compete to respond fastest on an uneven connection.',
          tone: 'mint',
        },
      ],
    },
    {
      id: 'make-waiting-useful',
      eyebrow: 'After a response',
      title: 'Give early responders something useful to do',
      blocks: [
        {
          type: 'paragraph',
          text: 'Dead time grows quickly in a large room. After submitting, students can review their answer, upvote a question, prepare one reason for their choice, or compare thinking with a neighbour. The task should support the current question, not distract from it.',
        },
        {
          type: 'table',
          headers: ['Interaction', 'Useful waiting task', 'Avoid'],
          rows: [
            ['Knowledge check', 'Write one reason for the answer', 'A separate game that breaks attention'],
            ['Prediction', 'Prepare to compare the prediction with the result', 'Showing the correct answer too early'],
            ['Open response', 'Upvote a question worth discussing', 'An unmoderated wall of comments'],
            ['Pulse check', 'Look up and wait for the class pattern', 'Asking for a second unrelated response'],
          ],
        },
      ],
    },
    {
      id: 'protect-time-and-access',
      eyebrow: 'What instructors can miss',
      title: 'Plan for access, privacy, and recovery',
      blocks: [
        {
          type: 'paragraph',
          text: 'Read the prompt aloud before starting a timer. Give enough time for students who process more slowly or use assistive technology. Keep a non-phone path available when possible. University of Illinois Chicago specifically recommends reading polling questions before timing begins and allowing more response time when students need it.',
        },
        {
          type: 'list',
          items: [
            'Do one phone test and one projector test in the teaching room.',
            'Tell students whether names, student numbers, or anonymous responses are being collected.',
            'Keep private pulse answers off the classroom display.',
            'Use a visible countdown for group work and a clear signal when lecture resumes.',
            'Have a no-technology fallback for the one interaction that matters most.',
          ],
        },
      ],
    },
    {
      id: 'carry-the-pattern-forward',
      eyebrow: 'After class',
      title: 'Use the session record to plan what comes next',
      blocks: [
        {
          type: 'paragraph',
          text: 'The live result matters, but the course pattern is more useful. Review which interactions actually ran, how broadly students participated, which questions remain open, and whether confidence is changing across sessions.',
        },
        {
          type: 'paragraph',
          text: 'Do not treat a quiet student or one low pulse as a diagnosis. Look for repeated patterns, sudden changes, and places where the whole class needs a different explanation. The record should support instructor judgment, not replace it.',
        },
        {
          type: 'cta',
          eyebrow: 'Start small',
          title: 'Prepare four moments for your next large lecture',
          body: 'Add an arrival check-in, one knowledge check, one question queue, and one closing reflection. Keep your current slides.',
          label: 'Create a class',
          href: '/signup',
          tone: 'coral',
        },
      ],
    },
    {
      id: 'sources-and-further-reading',
      eyebrow: 'Sources',
      title: 'University teaching guidance used for this plan',
      blocks: [
        {
          type: 'sources',
          items: [
            {
              title: 'Engaging Students in Large Courses',
              publisher: 'Cornell Center for Teaching Innovation',
              href: 'https://teaching.cornell.edu/teaching-resources/engaging-students/engaging-students-large-courses',
              note: 'Large-course routines, regular understanding checks, peer discussion, countdowns, and question follow-up.',
            },
            {
              title: 'Polling tips',
              publisher: 'Cornell Center for Teaching Innovation',
              href: 'https://teaching.cornell.edu/learning-technologies/assessment-tools/classroom-polling/polling-tips',
              note: 'Guidance on meaningful question volume and explaining answers after a poll.',
            },
            {
              title: 'Developing Poll Questions to Engage and Assess Student Thinking',
              publisher: 'Columbia University Center for Teaching and Learning',
              href: 'https://ctl.columbia.edu/resources-and-technology/resources/poll-questions-stem/',
              note: 'Using polls, open responses, peer upvotes, and repeated questions to make student thinking visible.',
            },
            {
              title: 'Active Learning',
              publisher: 'University of Illinois Chicago Center for the Advancement of Teaching Excellence',
              href: 'https://teaching.uic.edu/cate-teaching-guides/engaged-teaching-strategies/active-learning/',
              note: 'Polling as formative feedback, instructional decisions from distributions, and response-time accommodations.',
            },
          ],
        },
      ],
    },
  ],
  relatedSlugs: ['interactive-university-lecture-without-rebuilding-slides'],
};
