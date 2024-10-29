// src/app/videos/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { VideoCard } from '@/components/features/videos/video-card';
import { 
  Search, 
  X, 
  Filter, 
  Leaf, 
  Flame, 
  Star, 
  Clock,
  Zap,
  Camera,
  Music,
  Building2
} from 'lucide-react';

// Types
interface Video {
  id: string;
  title: string;
  description: string;
  price: number;
  thumbnailUrl?: string;
  duration?: string;
  author: {
    name: string;
    avatarUrl?: string;
  };
  views: number;
  category: string;
}

interface Category {
  id: string;
  icon: React.ComponentType<{ className?: string }>; // LucideIcon type with className prop
  label: string;
}

// Mock Data
const CATEGORIES: Category[] = [
  { id: 'nature', icon: Leaf, label: 'Nature' },
  { id: 'trending', icon: Flame, label: 'Trending' },
  { id: 'popular', icon: Star, label: 'Popular' },
  { id: 'new', icon: Clock, label: 'New' },
  { id: 'action', icon: Zap, label: 'Action' },
  { id: 'cinematic', icon: Camera, label: 'Cinematic' },
  { id: 'music', icon: Music, label: 'Music' },
  { id: 'architecture', icon: Building2, label: 'Architecture' },
];

const MOCK_VIDEOS: Video[] = [
  {
    id: '1',
    title: 'Breathtaking Mountain Sunrise',
    description: 'Stunning time-lapse footage of a sunrise over mountain peaks with moving clouds and changing colors.',
    price: 49.99,
    thumbnailUrl: 'https://images.unsplash.com/photo-1682687220199-d0745b66cc86',
    duration: '0:45',
    author: {
      name: 'Nature Films',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde',
    },
    views: 12543,
    category: 'nature'
  },
  {
    id: '2',
    title: 'Urban Life in Motion',
    description: 'Fast-paced city life captured in stunning 4K resolution. Perfect for documentaries and background footage.',
    price: 79.99,
    thumbnailUrl: 'https://images.unsplash.com/photo-1682687221038-404670f181c6',
    duration: '1:30',
    author: {
      name: 'City Visuals',
      avatarUrl: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36',
    },
    views: 8976,
    category: 'architecture'
  },
  {
    id: '3',
    title: 'Ocean Waves at Sunset',
    description: 'Calming ocean footage with golden hour lighting. Ideal for relaxation videos and backgrounds.',
    price: 34.99,
    thumbnailUrl: 'https://images.unsplash.com/photo-1682687220742-aba19b111b89',
    duration: '2:15',
    author: {
      name: 'Ocean Dreams',
    },
    views: 15234,
    category: 'nature'
  },
];

export default function VideosPage() {
    // Keep only the states we're actively using
    const [filteredVideos, setFilteredVideos] = useState<Video[]>(MOCK_VIDEOS);
    const [isLoading, setIsLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages] = useState(3); // Changed to const since we're not setting it
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 100]);
    const [sortOption, setSortOption] = useState<string>('newest');
    const [showFilters, setShowFilters] = useState(false);
  
    // Update useEffect to work with only filteredVideos
    useEffect(() => {
      let result = [...MOCK_VIDEOS];
  
      // Apply search filter
      if (searchQuery) {
        result = result.filter(video => 
          video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          video.description.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
  
      // Apply category filter
      if (selectedCategory) {
        result = result.filter(video => video.category === selectedCategory);
      }
  
      // Apply price filter
      result = result.filter(video => 
        video.price >= priceRange[0] && video.price <= priceRange[1]
      );
  
      // Apply sorting
      switch (sortOption) {
        case 'price-low':
          result.sort((a, b) => a.price - b.price);
          break;
        case 'price-high':
          result.sort((a, b) => b.price - a.price);
          break;
        case 'popular':
          result.sort((a, b) => b.views - a.views);
          break;
        // 'newest' is default
        default:
          result.sort((a, b) => b.id.localeCompare(a.id));
      }
  
      setFilteredVideos(result);
    }, [searchQuery, selectedCategory, priceRange, sortOption]);
  
    // Handle search with loading state
    const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setIsLoading(true);
      setTimeout(() => {
        setIsLoading(false);
      }, 1000);
    };
  

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 -mx-4 px-4 py-16 sm:-mx-6 sm:px-6">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        <div className="relative max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            Discover Premium Stock Videos
          </h1>
          <p className="text-blue-100 text-lg mb-8">
            High-quality footage for your next creative project
          </p>
          
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="search"
              placeholder="Search videos..."
              className="w-full pl-11 pr-20 py-4 bg-white rounded-xl shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              type="submit"
              className="absolute right-2 top-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Category Pills */}
      <div className="max-w-7xl mx-auto px-4 -mt-6 mb-8">
        <div className="bg-white rounded-2xl shadow-lg p-4">
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {CATEGORIES.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setSelectedCategory(id === selectedCategory ? null : id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all duration-200
                  ${selectedCategory === id 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                  }`}
              >
                <Icon className={`w-4 h-4 ${selectedCategory === id ? 'text-white' : 'text-gray-500'}`} />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        {/* Filters and Sort */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-8">
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm hover:shadow transition-all duration-200"
            >
              <Filter className="w-5 h-5 text-gray-500" />
              <span className="text-gray-700">Filters</span>
            </button>
            
            <select 
              className="px-4 py-2 bg-white rounded-lg shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
            >
              <option value="newest">Newest First</option>
              <option value="popular">Most Popular</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
          </div>

          {filteredVideos.length > 0 && (
            <p className="text-sm text-gray-600">
              Showing <span className="font-semibold">{filteredVideos.length}</span> results
            </p>
          )}
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mb-8 bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-900">Filters</h3>
              <button
                onClick={() => setShowFilters(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price Range (${priceRange[0]} - ${priceRange[1]})
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={priceRange[0]}
                  onChange={(e) => setPriceRange([parseInt(e.target.value), priceRange[1]])}
                  className="w-full"
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={priceRange[1]}
                  onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}

        {/* Videos Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="animate-pulse">
                <div className="rounded-2xl overflow-hidden">
                  <div className="aspect-[16/9] bg-gray-200"></div>
                  <div className="p-5 bg-white">
                    <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {filteredVideos.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                  <Search className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No videos found</h3>
                <p className="text-gray-500 max-w-md mx-auto">
                  We couldn`t find any videos matching your criteria. Try adjusting your filters or search term.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredVideos.map((video) => (
                  <VideoCard key={video.id} {...video} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Pagination */}
        {!isLoading && filteredVideos.length > 0 && totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-12">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-6 py-3 bg-white rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:shadow transition-all duration-200"
            >
              Previous
            </button>
            <div className="flex items-center px-4">
              <span className="text-sm font-medium text-gray-700">
                Page {page} of {totalPages}
              </span>
            </div>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-6 py-3 bg-white rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:shadow transition-all duration-200"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}