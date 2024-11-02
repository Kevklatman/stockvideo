'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { VideoCard } from '@/components/features/videos/video-card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface ApiVideo {
  id: string;
  title: string;
  description: string;
  fullVideoUrl: string;
  previewUrl: string;
  price: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  likes?: number;
  duration?: number;
  views?: number;
  user: {
    email: string;
    id: string;
    role: string;
  };
}

interface Purchase {
  id: string;
  videoId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

interface Video {
  id: string;
  title: string;
  thumbnailUrl: string;
  videoUrl: string;
  authorName: string;
  price: string;
  description: string;
  createdAt: Date;
  authorId: string;
  likes: number;
  duration: number;
  views: number;
  purchased?: boolean;
}

interface FetchState {
  loading: boolean;
  error: string | null;
  data: Video[];
}

export default function VideosPage() {
  const [fetchState, setFetchState] = useState<FetchState>({
    loading: true,
    error: null,
    data: []
  });
  const { user, isInitialized } = useAuth();

  const transformVideos = useCallback((
    apiVideos: ApiVideo[],
    purchasedVideoIds: string[],
    currentUserId?: string
  ): Video[] => {
    return apiVideos.map(video => ({
      id: video.id,
      title: video.title,
      thumbnailUrl: video.previewUrl || '',
      videoUrl: video.fullVideoUrl,
      authorName: video.user.email.split('@')[0],
      price: video.price,
      description: video.description,
      createdAt: new Date(video.createdAt),
      authorId: video.userId,
      likes: video.likes || 0,
      duration: video.duration || 0,
      views: video.views || 0,
      purchased: video.userId === currentUserId || purchasedVideoIds.includes(video.id)
    }));
  }, []);

  const fetchVideos = useCallback(async () => {
    try {
      const [videosResponse, purchasedResponse] = await Promise.all([
        fetch('/api/videos'),
        user ? fetch('/api/purchases') : Promise.resolve(null)
      ]);

      if (!videosResponse.ok) {
        throw new Error('Failed to fetch videos');
      }

      const videosData = await videosResponse.json();
      const purchasedData = purchasedResponse?.ok 
        ? await purchasedResponse.json() 
        : [];

      const purchasedVideoIds = (purchasedData as Purchase[]).map(p => p.videoId);
      const videoArray = Array.isArray(videosData) 
        ? videosData 
        : videosData.videos || videosData.data || [];

      const transformedVideos = transformVideos(videoArray, purchasedVideoIds, user?.id);

      setFetchState({
        loading: false,
        error: null,
        data: transformedVideos
      });
    } catch (err) {
      console.error('Error fetching videos:', err);
      setFetchState(state => ({
        ...state,
        loading: false,
        error: err instanceof Error ? err.message : 'An error occurred'
      }));
    }
  }, [user, transformVideos]);

  useEffect(() => {
    if (!isInitialized) return;
    fetchVideos();
  }, [isInitialized, fetchVideos]);

  if (!isInitialized || fetchState.loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center min-h-[200px]">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (fetchState.error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center bg-red-50 p-4 rounded-lg">
          <p className="text-red-600">Error: {fetchState.error}</p>
          <button 
            onClick={fetchVideos}
            className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Videos</h1>
        <div className="flex gap-4">
          {/* Add filter/sort controls here if needed */}
        </div>
      </div>
      
      {fetchState.data.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {fetchState.data.map((video) => (
            <VideoCard
              key={video.id}
              {...video}
            />
          ))}
        </div>
      ) : (
        <div className="text-center bg-gray-50 p-8 rounded-lg">
          <p className="text-gray-600">No videos available</p>
        </div>
      )}
    </div>
  );
}