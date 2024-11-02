'use client';

import { useState, useEffect, useMemo } from 'react';
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
  status?: 'published' | 'processing';
  views?: number;
  userId: string;
  price: number;
}

interface VideoResponse {
  videos: UserVideo[];
  total: number;
  pages: number;
}

type FilterType = 'all' | 'published' | 'processing';
type SortType = 'newest' | 'oldest' | 'popular';

const VideoCard = ({ video }: { video: UserVideo }) => {
  return (
    <div className="bg-white rounded-xl p-6">
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
        previewMode={false}
        onPurchaseClick={() => {}}
      />
      <div className="mt-4">
        <h3 className="text-lg font-medium text-gray-900">{video.title}</h3>
        <p className="text-gray-500 text-sm mt-1">
          {new Date(video.createdAt).toLocaleDateString()} • {video.views} views
        </p>
        <p className="text-gray-600 mt-2">{video.description}</p>
      </div>
    </div>
  );
};

const LoadingSkeleton = () => (
  <div className="max-w-7xl mx-auto px-4 py-8">
    <div className="flex justify-between items-center mb-8">
      <div className="h-8 w-48 bg-gray-200 rounded animate-pulse"></div>
      <div className="h-10 w-32 bg-gray-200 rounded animate-pulse"></div>
    </div>
    <div className="space-y-8">
      {[1, 2, 3].map((n) => (
        <div key={n} className="bg-white rounded-xl p-6">
          <div className="aspect-video bg-gray-200 rounded-lg mb-4 animate-pulse"></div>
          <div className="h-6 bg-gray-200 w-1/3 rounded mb-2 animate-pulse"></div>
          <div className="h-4 bg-gray-200 w-1/4 rounded animate-pulse"></div>
        </div>
      ))}
    </div>
  </div>
);

export default function MyVideosPage() {
  const [videos, setVideos] = useState<UserVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('newest');
  const { user } = useAuth();
  const router = useRouter();

  const filteredVideos = useMemo(() => {
    return videos.filter(video => 
      filter === 'all' ? true : video.status === filter
    );
  }, [videos, filter]);

  useEffect(() => {
    if (!user) {
      router.push('/login?redirect=/api/videos/my-videos');
      return;
    }

    const fetchUserVideos = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const queryString = new URLSearchParams({
          page: page.toString(),
          limit: '10',
          filter,
          sort
        }).toString();
        
        const response = await api.get<VideoResponse>(`/api/videos/user?${queryString}`);
        setVideos(response.videos);
        setTotalPages(response.pages);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load videos');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserVideos();
  }, [user, router, page, filter, sort]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as FilterType;
    setFilter(value);
    setPage(1); // Reset to first page when filter changes
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as SortType;
    setSort(value);
    setPage(1); // Reset to first page when sort changes
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!user) {
    return null;
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Videos</h3>
          <p className="text-red-600">{error}</p>
          <button 
            onClick={() => setPage(1)}
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
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-gray-500" />
            <select
              value={filter}
              onChange={handleFilterChange}
              className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Videos</option>
              <option value="published">Published</option>
              <option value="processing">Processing</option>
            </select>
          </div>
          <select
            value={sort}
            onChange={handleSortChange}
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

      <div className="space-y-8">
        {filteredVideos.map((video) => (
          <VideoCard key={video.id} video={video} />
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
    </div>
  );
}