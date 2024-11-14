// src/app/seller/onboarding/[status]/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function OnboardingStatusPage({ 
  params 
}: { 
  params: { status: 'complete' | 'refresh' } 
}) {
  const router = useRouter();

  useEffect(() => {
    const completeOnboarding = async () => {
      try {
        if (params.status === 'complete') {
          await api.post('/api/seller/onboarding-complete');
          router.push('/seller?onboarding=success');
        } else {
          router.push('/seller?onboarding=refresh');
        }
      } catch (error) {
        console.error('Error completing onboarding:', error);
        router.push('/seller?onboarding=error');
      }
    };

    completeOnboarding();
  }, [params.status, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="large" />
    </div>
  );
}