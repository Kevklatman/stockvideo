// src/app/videos/page.tsx
'use client';

import { useEffect, useState } from 'react';
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
  user: {
    email: string;
    id: string;
    role: string;
  };
}

interface Video {
  id: string;
  title: string;
  thumbnailUrl: string;
  videoUrl: string;
  authorName: string;
  _id?: string;
  author?: {
    name: string;
  };
  likes: number;
  duration: number;
  views: number;
}

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const response = await fetch('/api/videos');
        if (!response.ok) {
          throw new Error('Failed to fetch videos');
        }
        const data = await response.json();
        
        console.log('API Response:', data);

        const videoArray = Array.isArray(data) 
          ? data 
          : data.videos || data.data || [];

        const transformedVideos = videoArray.map((video: ApiVideo) => ({
          id: video.id,
          title: video.title,
          thumbnailUrl: video.previewUrl || '',
          videoUrl: video.fullVideoUrl,
          authorName: video.user.email.split('@')[0], // Using email username as author name
          author: {
            name: video.user.email.split('@')[0]
          },
          likes: 0, // Default values since these aren't in the API
          duration: 0,
          views: 0,
          price: video.price,
          description: video.description,
          createdAt: new Date(video.createdAt),
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
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">Error: {error}</div>
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
              likes={video.likes}
              duration={video.duration}
              views={video.views}
              price={video.price}
              description={video.description}
              createdAt={video.createdAt}

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