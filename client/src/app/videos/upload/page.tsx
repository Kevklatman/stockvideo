'use client';

import { type ReactElement } from 'react';
import VideoUpload from '@/components/features/videos/video-upload';
import { useAuth } from '@/providers/auth-provider';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function UploadPage(): ReactElement | null {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login?redirect=/videos/upload');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <VideoUpload />;
}