import type { Metadata } from 'next';
import { privateRouteMetadata } from '@/lib/metadata';

export const metadata: Metadata = {
  ...privateRouteMetadata,
  title: 'Class teams',
};

export default function ClassTeamsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
