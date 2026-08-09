import type { Metadata } from 'next';
import { privateRouteMetadata } from '@/lib/metadata';

export const metadata: Metadata = {
  ...privateRouteMetadata,
  title: 'Class session',
};

export default function SessionRouteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
