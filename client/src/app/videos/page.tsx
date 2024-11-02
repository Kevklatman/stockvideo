'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { VideoCard } from '@/components/features/videos/video-card';

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

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isInitialized } = useAuth();

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    const fetchVideos = async () => {
      try {
        const videosResponse = await fetch('/api/videos');
        if (!videosResponse.ok) {
          throw new Error('Failed to fetch videos');
        }
        const videosData = await videosResponse.json();

        let purchasedVideos: string[] = [];
        if (user) {
          const purchasedResponse = await fetch('/api/purchases');
          if (purchasedResponse.ok) {
            const purchasedData: Purchase[] = await purchasedResponse.json();
            purchasedVideos = purchasedData.map((purchase) => purchase.videoId);
          }
        }

        const videoArray = Array.isArray(videosData) 
          ? videosData 
          : videosData.videos || videosData.data || [];

        const transformedVideos = videoArray.map((video: ApiVideo) => ({
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
          purchased: video.userId === user?.id || purchasedVideos.includes(video.id)
        }));

        setVideos(transformedVideos);
      } catch (err) {
        console.error('Error fetching videos:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, [user, isInitialized]);

  if (!isInitialized) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-gray-500">
          Loading...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-red-500">
          Error: {error}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-gray-500">
          Loading videos...
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Videos</h1>
      
      {videos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {videos.map((video) => (
            <VideoCard
              key={video.id}
              id={video.id}
              title={video.title}
              thumbnailUrl={video.thumbnailUrl}
              videoUrl={video.videoUrl}
              authorName={video.authorName}
              price={video.price}
              description={video.description}
              createdAt={video.createdAt}
              authorId={video.authorId}
              likes={video.likes}
              duration={video.duration}
              views={video.views}
              purchased={video.purchased}
            />
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-500 mt-8">
          No videos found
        </div>
      )}
    </div>
  );
}