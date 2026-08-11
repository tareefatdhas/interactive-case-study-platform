import type { CourseSource, CourseSourceKind } from '@/types';

export const MAX_COURSE_SOURCES = 10;
export const MAX_COURSE_SOURCE_CHARS = 24_000;
export const MAX_COMBINED_SOURCE_CHARS = 48_000;

export const COURSE_SOURCE_KINDS: Array<{ value: CourseSourceKind; label: string }> = [
  { value: 'syllabus', label: 'Syllabus or course outline' },
  { value: 'slides', label: 'Slides or lecture notes' },
  { value: 'reading', label: 'Reading' },
  { value: 'case', label: 'Case material' },
  { value: 'notes', label: 'Teaching notes' },
];

export const normalizeCourseSource = (source: CourseSource): CourseSource => ({
  ...source,
  title: source.title.trim().slice(0, 100),
  content: source.content.trim().slice(0, MAX_COURSE_SOURCE_CHARS),
  fileName: source.fileName?.trim().slice(0, 160) || undefined,
});

export const upsertCourseSource = (sources: CourseSource[], source: CourseSource): CourseSource[] => {
  const normalized = normalizeCourseSource(source);
  const exists = sources.some((candidate) => candidate.id === normalized.id);
  if (!exists && sources.length >= MAX_COURSE_SOURCES) {
    throw new Error(`Keep up to ${MAX_COURSE_SOURCES} course sources. Remove one before adding another.`);
  }
  return exists
    ? sources.map((candidate) => candidate.id === normalized.id ? normalized : candidate)
    : [normalized, ...sources];
};

export const removeCourseSource = (sources: CourseSource[], sourceId: string): CourseSource[] => (
  sources.filter((source) => source.id !== sourceId)
);

export const buildLessonMaterial = (
  sources: CourseSource[],
  selectedSourceIds: string[],
  additionalMaterial: string,
): string => {
  const selected = selectedSourceIds
    .map((sourceId) => sources.find((source) => source.id === sourceId))
    .filter((source): source is CourseSource => Boolean(source));
  const sourceMaterial = selected.map((source) => `Source: ${source.title}\n${source.content}`).join('\n\n---\n\n');
  const sessionNotes = additionalMaterial.trim() ? `Session notes\n${additionalMaterial.trim()}` : '';
  if (!sessionNotes) return sourceMaterial.slice(0, MAX_COMBINED_SOURCE_CHARS);
  if (!sourceMaterial) return sessionNotes.slice(0, MAX_COMBINED_SOURCE_CHARS);

  const divider = '\n\n---\n\n';
  const sourceBudget = Math.max(0, MAX_COMBINED_SOURCE_CHARS - sessionNotes.length - divider.length);
  return `${sourceMaterial.slice(0, sourceBudget)}${divider}${sessionNotes}`.slice(-MAX_COMBINED_SOURCE_CHARS);
};

export const courseSourceWordCount = (content: string): number => (
  content.trim() ? content.trim().split(/\s+/).length : 0
);
