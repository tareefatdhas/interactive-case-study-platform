import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/metadata';

const publicRoutes = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/instructors', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/students', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/pricing', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/resources', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/legal', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/data-policy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency,
    priority,
  }));
}
