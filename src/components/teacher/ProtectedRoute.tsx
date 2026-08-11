'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import DashboardLayout from '@/components/teacher/DashboardLayout';
import { AmbientLoading } from '@/components/motion';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="grid min-h-96 place-items-center" role="status" aria-label="Opening your Classfully workspace">
          <AmbientLoading className="w-44 rounded-full" announce="off" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
