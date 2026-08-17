import type { Metadata } from 'next';
import { privateRouteMetadata } from '@/lib/metadata';

export const metadata: Metadata = {
  ...privateRouteMetadata,
  title: 'Teaching invitation',
};

export default function TeachingInvitationLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
