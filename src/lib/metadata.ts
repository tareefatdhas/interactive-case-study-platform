import type { Metadata } from 'next';

export const SITE_NAME = 'Classfully';
export const SITE_URL = 'https://classfully.com';
export const DEFAULT_DESCRIPTION =
  'Run live polls, quizzes, check-ins, questions, and classroom discussions while attendance, participation, confidence, and student progress build across every session.';

type PageMetadata = {
  title: string;
  description: string;
  path: `/${string}` | '/';
};

export function createPageMetadata({ title, description, path }: PageMetadata): Metadata {
  const socialTitle = `${title} | ${SITE_NAME}`;

  return {
    title,
    description,
    alternates: {
      canonical: path,
      languages: {
        en: path,
      },
    },
    openGraph: {
      title: socialTitle,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: 'en_US',
      type: 'website',
      images: [
        {
          url: '/opengraph-image',
          width: 1200,
          height: 630,
          alt: `${SITE_NAME}, classroom participation that builds over time`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description,
      images: ['/twitter-image'],
    },
  };
}

export const privateRouteMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};
