import type { Metadata } from 'next';
import { privateRouteMetadata } from '@/lib/metadata';

export const metadata: Metadata = {
  ...privateRouteMetadata,
  title: 'Live lesson',
  description: 'A live classroom pulse and feedback console for university instructors.',
};

export default function LiveLessonLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
