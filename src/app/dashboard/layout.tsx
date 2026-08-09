import type { Metadata } from 'next';
import { privateRouteMetadata } from '@/lib/metadata';

export const metadata: Metadata = {
  ...privateRouteMetadata,
  title: 'Instructor workspace',
};

export default function DashboardRouteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
