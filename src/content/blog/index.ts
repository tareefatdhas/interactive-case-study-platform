import { interactiveLectureWithoutRebuildingSlides } from './posts/interactive-lecture-without-rebuilding-slides';
import { engage100StudentsInALecture } from './posts/engage-100-students-in-a-lecture';
import type { BlogPost } from './types';

export const allBlogPosts: BlogPost[] = [
  interactiveLectureWithoutRebuildingSlides,
  engage100StudentsInALecture,
];

export const blogPosts = allBlogPosts.filter((post) => post.status === 'published').sort(
  (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
);

export function getBlogPost(slug: string) {
  const post = allBlogPosts.find((candidate) => candidate.slug === slug);
  if (!post) return undefined;
  if (post.status === 'published' || process.env.VERCEL_ENV !== 'production') return post;
  return undefined;
}

export function getFeaturedBlogPost() {
  return blogPosts.find((post) => post.featured) ?? blogPosts[0];
}

export function formatBlogDate(date: string) {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

export function getAuthorInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
