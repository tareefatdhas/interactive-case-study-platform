'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function CaseStudyViewPage() {
  const router = useRouter();
  const params = useParams();
  const caseStudyId = params?.id as string;

  useEffect(() => {
    // Redirect to the edit page since we don't have a separate view page yet
    if (caseStudyId) {
      router.replace(`/dashboard/case-studies/${caseStudyId}/edit`);
    }
  }, [caseStudyId, router]);

  return null; // This will redirect before rendering
}