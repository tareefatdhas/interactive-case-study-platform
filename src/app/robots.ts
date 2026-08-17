import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/metadata';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/dashboard/',
        '/join',
        '/live/',
        '/login',
        '/session/',
        '/signup',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
