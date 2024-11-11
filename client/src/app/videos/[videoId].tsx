'use client'

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { User, Share2 } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { api, ApiException } from '@/lib/api';
import VideoPlayer from '@/components/features/videos/VideoPlayer';
import { PaymentModal } from '@/components/features/videos/PaymentModal';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Video {
  id: string;
  title: string;
  description: string;
  previewUrl: string;
  fullVideoUrl: string;
  thumbnailUrl: string;
  price: number;
  createdAt: string;
  views: number;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

interface AccessStatus {
  hasAccess: boolean;
  isOwner: boolean;
}

const LoadingState = () => (
  <div className="max-w-7xl mx-auto px-4 py-6">
    <div className="animate-pulse">
      <div className="aspect-video bg-gray-200 rounded-lg mb-6" />
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
      </div>
    </div>
  </div>
);

const ErrorState = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <div className="max-w-7xl mx-auto px-4 py-6">
    <div className="bg-red-50 rounded-xl p-6 text-center">
      <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Video</h3>
      <p className="text-red-600 mb-4">{message}</p>
      {onRetry && (
        <button 
          onClick={onRetry}
          className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  </div>
);

export default function VideoWatchPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [video, setVideo] = useState<Video | null>(null);
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const fetchVideo = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const videoData = await api.get<Video>(`/api/videos/${videoId}`);
      setVideo(videoData);

      if (user) {
        const accessData = await api.get<AccessStatus>(`/api/videos/${videoId}/access`);
        setAccessStatus(accessData);
      }
    } catch (err) {
      console.error('Error fetching video:', err);
      if (err instanceof ApiException) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (videoId) {
      fetchVideo();
    }
  }, [videoId, user]);

  const handleShare = async () => {
    try {
      await navigator.share({
        title: video?.title,
        text: video?.description,
        url: window.location.href
      });
    } catch (err) {
      // Fallback to copying URL
      await navigator.clipboard.writeText(window.location.href);
      // You might want to show a toast notification here
    }
  };

  const handlePaymentSuccess = async (paymentIntentId: string) => {
    if (!videoId) return;
    
    router.push(`/payment/success?payment_intent=${paymentIntentId}&video_id=${videoId}`);
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchVideo} />;
  }

  if (!video) {
    return null;
  }

  const canWatchFullVideo = accessStatus?.hasAccess || accessStatus?.isOwner;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <VideoPlayer 
          videoId={video.id}
          thumbnailUrl={video.thumbnailUrl}
          initialUrls={{
            streamingUrl: video.fullVideoUrl,
            previewUrl: video.previewUrl,
            thumbnailUrl: video.thumbnailUrl
          }}
          previewMode={!canWatchFullVideo}
          isPurchased={canWatchFullVideo}
          onPurchaseClick={() => !user ? router.push('/login') : setShowPaymentModal(true)}
        />
      </div>

      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {video.title}
        </h1>
        <div className="flex items-center space-x-4 text-sm text-gray-500">
          <span>{video.views?.toLocaleString() || 0} views</span>
          <span>•</span>
          <span>{new Date(video.createdAt).toLocaleDateString()}</span>
          {!canWatchFullVideo && (
            <>
              <span>•</span>
              <span className="text-blue-600 font-medium">
                ${video.price.toFixed(2)}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center py-4 border-t border-b border-gray-200">
        <Link
          href={`/profile/${video.user.id}`}
          className="flex items-center space-x-3"
        >
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
            <User className="w-6 h-6 text-gray-500" />
          </div>
          <div>
            <h2 className="font-medium text-gray-900">
              {video.user.email.split('@')[0]}
            </h2>
          </div>
        </Link>

        <div className="flex items-center space-x-4">
          {!canWatchFullVideo && (
            <button
              onClick={() => !user ? router.push('/login') : setShowPaymentModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Purchase Video
            </button>
          )}
          <button
            onClick={handleShare}
            className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            title="Share video"
          >
            <Share2 className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-gray-700 whitespace-pre-wrap">
          {video.description}
        </p>
      </div>

      {showPaymentModal && (
        <PaymentModal
          videoId={video.id}
          price={video.price}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}