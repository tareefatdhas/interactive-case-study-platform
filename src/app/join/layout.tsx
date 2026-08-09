import type { Metadata } from 'next';
import { privateRouteMetadata } from '@/lib/metadata';

export const metadata: Metadata = {
  ...privateRouteMetadata,
  title: 'Join a class',
};

export default function JoinRouteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
