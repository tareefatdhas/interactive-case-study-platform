import type { Metadata } from 'next';
import { privateRouteMetadata } from '@/lib/metadata';

export const metadata: Metadata = privateRouteMetadata;

export default function AuthRouteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
