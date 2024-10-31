'use client'

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Heart, Share2, User, Upload, AlertCircle } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { api, ApiException } from '@/lib/api';
import VideoPlayer from '@/components/features/videos/VideoPlayer';
import Link from 'next/link';

type Video = {
  id: string;
  title: string;
  description: string;
  url: string;
  thumbnailUrl: string;
  views: number;
  likes: number;
  createdAt: string;
  user: {
    id: string;
    name: string;
    avatarUrl: string;
  };
};

type EmptyStateProps = {
  type: 'no-videos' | 'no-access' | 'error';
  message: string;
  action?: {
    label: string;
    href: string;
  };
};

const EmptyState = ({ type, message, action }: EmptyStateProps) => {
  const illustrations = {
    'no-videos': (
      <div className="bg-gray-50 rounded-lg p-12 flex flex-col items-center">
        <Upload className="w-16 h-16 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No videos found</h3>
        <p className="text-gray-500 text-center mb-6 max-w-md">{message}</p>
        {action && (
          <Link
            href={action.href}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {action.label}
          </Link>
        )}
      </div>
    ),
    'no-access': (
      <div className="bg-yellow-50 rounded-lg p-12 flex flex-col items-center">
        <AlertCircle className="w-16 h-16 text-yellow-400 mb-4" />
        <h3 className="text-lg font-medium text-yellow-900 mb-2">Access Restricted</h3>
        <p className="text-yellow-700 text-center mb-6 max-w-md">{message}</p>
        {action && (
          <Link
            href={action.href}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-yellow-900 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
          >
            {action.label}
          </Link>
        )}
      </div>
    ),
    'error': (
      <div className="bg-red-50 rounded-lg p-12 flex flex-col items-center">
        <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
        <h3 className="text-lg font-medium text-red-900 mb-2">Error</h3>
        <p className="text-red-700 text-center mb-6 max-w-md">{message}</p>
        {action && (
          <Link
            href={action.href}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-red-900 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            {action.label}
          </Link>
        )}
      </div>
    ),
  };

  return (
    <div className="flex justify-center items-center min-h-[400px]">
      {illustrations[type]}
    </div>
  );
};

const LoadingState = () => (
  <div className="max-w-7xl mx-auto px-4 py-6">
    <div className="animate-pulse">
      <div className="aspect-video bg-gray-200 rounded-lg mb-6" />
      <div className="h-8 bg-gray-200 rounded w-3/4 mb-4" />
      <div className="h-4 bg-gray-200 rounded w-1/2" />
    </div>
  </div>
);

const VideoMetrics = ({ views, date }: { views: number; date: string }) => (
  <div className="flex items-center space-x-4 text-sm text-gray-500">
    <span>{views.toLocaleString()} views</span>
    <span>•</span>
    <span>{new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}</span>
  </div>
);

const VideoActions = ({ 
  isLiked, 
  onLike, 
  onShare 
}: { 
  isLiked: boolean; 
  onLike: () => void; 
  onShare: () => void;
}) => (
  <div className="flex space-x-4">
    <button
      onClick={onLike}
      className={`p-2 rounded-full transition-colors ${
        isLiked ? 'bg-red-100 text-red-600' : 'bg-gray-100 hover:bg-gray-200'
      }`}
      title="Like video"
    >
      <Heart className={`w-6 h-6 ${isLiked ? 'fill-current' : ''}`} />
    </button>
    <button
      onClick={onShare}
      className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
      title="Share video"
    >
      <Share2 className="w-6 h-6" />
    </button>
  </div>
);

export default function VideoWatchPage() {
  const { videoId } = useParams();
  const { user } = useAuth();
  
  const [video, setVideo] = useState<Video | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    const fetchVideo = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await api.get(`/api/videos/${videoId}`);
        setVideo((response as { data: Video }).data);
        // Fetch like status if user is logged in
        if (user) {
          const likeStatus = await api.get(`/api/videos/${videoId}/like-status`);
          setIsLiked((likeStatus as { data: { isLiked: boolean } }).data.isLiked);
        }
      } catch (err) {
        if (err instanceof ApiException) {
          setError(err.message);
        } else {
          setError('An unexpected error occurred');
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (videoId) {
      fetchVideo();
    }
  }, [videoId, user]);

  const handleLike = async () => {
    if (!user) {
      window.location.href = `/login?redirect=/videos/${videoId}`;
      return;
    }

    try {
      await api.post(`/api/videos/${videoId}/like`);
      setIsLiked(!isLiked);
      if (video) {
        setVideo({
          ...video,
          likes: isLiked ? video.likes - 1 : video.likes + 1
        });
      }
    } catch (err) {
      console.error('Error updating like status:', err);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: video?.title,
        text: video?.description,
        url: window.location.href,
      });
    } catch (err) {
      // Fallback to copying to clipboard
      navigator.clipboard.writeText(window.location.href);
      // You might want to show a toast notification here
    }
  };

  const getEmptyState = (): EmptyStateProps | null => {
    if (!error && !video) {
      return {
        type: 'no-videos',
        message: 'Start sharing your content with the world by uploading your first video.',
        action: {
          label: 'Upload Video',
          href: '/videos/upload'
        }
      };
    }

    if (error?.includes('logged in')) {
      return {
        type: 'no-access',
        message: 'Please log in to view this video.',
        action: {
          label: 'Log In',
          href: `/login?redirect=/videos/${videoId}`
        }
      };
    }

    if (error) {
      return {
        type: 'error',
        message: error,
        action: error.includes('permission') ? {
          label: 'Go to Homepage',
          href: '/'
        } : undefined
      };
    }

    return null;
  };

  if (isLoading) {
    return <LoadingState />;
  }

  const emptyState = getEmptyState();
  if (emptyState) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <EmptyState {...emptyState} />
      </div>
    );
  }

  if (!video) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <VideoPlayer 
          url={video.url}
          thumbnailUrl={video.thumbnailUrl} videoId={''}        />
      </div>
      
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {video.title}
        </h1>
        <VideoMetrics 
          views={video.views} 
          date={video.createdAt}
        />
      </div>

      <div className="flex justify-between items-center py-4 border-t border-b border-gray-200">
        <Link
          href={`/profile/${video.user.id}`}
          className="flex items-center space-x-3"
        >
          {video.user.avatarUrl ? (
            <img
              src={video.user.avatarUrl}
              alt={video.user.name}
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
              <User className="w-6 h-6 text-gray-500" />
            </div>
          )}
          <div>
            <h2 className="font-medium text-gray-900">{video.user.name}</h2>
          </div>
        </Link>

        <VideoActions
          isLiked={isLiked}
          onLike={handleLike}
          onShare={handleShare}
        />
      </div>

      <div className="mt-4">
        <p className="text-gray-700 whitespace-pre-wrap">
          {video.description}
        </p>
      </div>
    </div>
  );
}