export type ContentCalendarItem = {
  slug: string;
  workingTitle: string;
  status: 'idea' | 'research' | 'draft' | 'review' | 'published';
  contentFamily: 'Classroom practice' | 'Student participation' | 'Course progress' | 'Tools and comparisons';
  primaryQuery: string;
  intent: 'learn' | 'compare' | 'act';
  priority: 'high' | 'medium' | 'low';
  originalValue: string;
};

export const contentCalendar: ContentCalendarItem[] = [
  {
    slug: 'interactive-university-lecture-without-rebuilding-slides',
    workingTitle: 'How to make a university lecture interactive without rebuilding your slides',
    status: 'published',
    contentFamily: 'Classroom practice',
    primaryQuery: 'how to make university lectures interactive',
    intent: 'act',
    priority: 'high',
    originalValue: 'A decision-led 50-minute lecture plan that works beside existing slides.',
  },
  {
    slug: 'mentimeter-alternatives-for-university-classrooms',
    workingTitle: 'Choosing a Mentimeter alternative for a university course',
    status: 'idea',
    contentFamily: 'Tools and comparisons',
    primaryQuery: 'Mentimeter alternatives for education',
    intent: 'compare',
    priority: 'high',
    originalValue: 'A course-first comparison based on continuity, class management, and student progress.',
  },
  {
    slug: 'engage-100-students-in-a-lecture',
    workingTitle: 'How to engage 100 students without losing control of the lecture',
    status: 'idea',
    contentFamily: 'Classroom practice',
    primaryQuery: 'how to engage students in large lectures',
    intent: 'act',
    priority: 'high',
    originalValue: 'A facilitation pattern for questions, upvotes, pacing signals, and moderated projection.',
  },
  {
    slug: 'track-student-confidence-across-a-course',
    workingTitle: 'How to track student confidence without turning it into a grade',
    status: 'idea',
    contentFamily: 'Course progress',
    primaryQuery: 'track student confidence',
    intent: 'learn',
    priority: 'medium',
    originalValue: 'A privacy-aware way to connect confidence checks across sessions and act on the trend.',
  },
];
