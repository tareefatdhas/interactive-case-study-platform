import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Live lesson | Classfully',
  description: 'A live classroom pulse and feedback console for university instructors.',
};

export default function LiveLessonLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
