'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, AlertCircle, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { api } from '@/lib/api';
import VideoPlayer from '@/components/features/videos/VideoPlayer';
import Link from 'next/link';

interface UserVideo {
  id: string;
  title: string;
  description: string;
  previewUrl: string;
  fullVideoUrl: string;
  createdAt: string;
  status: 'published' | 'processing';
  views: number;
  userId: string;
  price: number;
}

interface VideoResponse {
  videos: UserVideo[];
  total: number;
  pages: number;
}

export default function MyVideosPage() {
  const [videos, setVideos] = useState<UserVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<'all' | 'published' | 'processing'>('all');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'popular'>('newest');
  
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    const fetchUserVideos = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await api.get<VideoResponse>(`/api/videos/user?page=${page}&limit=10&filter=${filter}&sort=${sort}`);

        if (!response) {
          throw new Error('Invalid response from server');
        }

        const { videos: responseVideos, pages } = response;
        
        setVideos(responseVideos);
        setTotalPages(pages);
      } catch (err) {
        console.error('Error fetching videos:', err);
        setError(err instanceof Error ? err.message : 'Failed to load videos');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserVideos();
  }, [user, page, filter, sort]);

  const handleFilterChange = (newFilter: typeof filter) => {
    setFilter(newFilter);
    setPage(1); // Reset to first page when filter changes
  };

  const handleSortChange = (newSort: typeof sort) => {
    setSort(newSort);
    setPage(1); // Reset to first page when sort changes
  };

  if (!user) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-10 w-32 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="grid gap-8">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white rounded-xl p-6 shadow-sm">
              <div className="aspect-video bg-gray-200 rounded-lg mb-4 animate-pulse"></div>
              <div className="space-y-2">
                <div className="h-6 bg-gray-200 w-1/3 rounded animate-pulse"></div>
                <div className="h-4 bg-gray-200 w-1/4 rounded animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Videos</h3>
          <p className="text-red-600">{error}</p>
          <button 
            onClick={() => {
              setPage(1);
              setError(null);
            }}
            className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Videos</h1>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-gray-500" />
            <select
              value={filter}
              onChange={(e) => handleFilterChange(e.target.value as typeof filter)}
              className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Videos</option>
              <option value="published">Published</option>
              <option value="processing">Processing</option>
            </select>
          </div>

          <select
            value={sort}
            onChange={(e) => handleSortChange(e.target.value as typeof sort)}
            className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="popular">Most Viewed</option>
          </select>

          <Link
            href="/videos/upload"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Upload New Video
          </Link>
        </div>
      </div>

      {videos.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Videos Yet</h3>
          <p className="text-gray-500 mb-6">Start sharing your content with the world</p>
          <Link
            href="/videos/upload"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Upload Your First Video
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-8">
            {videos.map((video) => (
              <div key={video.id} className="bg-white rounded-xl p-6 shadow-sm">
                {video.status === 'processing' && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-yellow-800 text-sm">
                      This video is still processing. It will be available soon.
                    </p>
                  </div>
                )}
                <VideoPlayer
                  videoId={video.id}
                  url={video.fullVideoUrl}
                  thumbnailUrl={video.previewUrl}
                  isPurchased={true}
                />
                <div className="mt-4">
                  <h3 className="text-lg font-medium text-gray-900">{video.title}</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                    <span>{new Date(video.createdAt).toLocaleDateString()}</span>
                    <span>•</span>
                    {video.price > 0 && (
                      <>
                        <span>•</span>
                      </>
                    )}
                  </div>
                  <p className="text-gray-600 mt-2 line-clamp-2">{video.description}</p>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}