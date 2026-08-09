import type { MetadataRoute } from 'next';
import { DEFAULT_DESCRIPTION } from '@/lib/metadata';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Classfully',
    short_name: 'Classfully',
    description: DEFAULT_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#fffdf8',
    theme_color: '#5146e5',
    icons: [
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
