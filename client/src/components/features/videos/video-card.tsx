// src/components/features/videos/video-card.tsx
import Link from 'next/link';
import { Play, User, Heart } from 'lucide-react';
import { useState } from 'react';

interface VideoCardProps {
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
  views?: number;
}

export function VideoCard({
  id,
  title,
  description,
  price,
  thumbnailUrl = 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7',
  duration = "3:45",
  author,
  views = 1234
}: VideoCardProps) {
  const [isLiked, setIsLiked] = useState(false);

  return (
    <div className="group relative bg-white rounded-2xl overflow-hidden transform transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
      <Link href={`/videos/${id}`}>
        <div className="relative aspect-[16/9] overflow-hidden bg-gray-100">
          <img
            src={thumbnailUrl}
            alt={title}
            className="object-cover w-full h-full transform transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          {/* Premium Badge */}
          {price > 50 && (
            <div className="absolute top-3 left-3 px-2 py-1 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full">
              <span className="text-xs font-semibold text-white tracking-wide">PREMIUM</span>
            </div>
          )}
          
          {/* Duration Badge */}
          <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/70 backdrop-blur-md rounded-md">
            <span className="text-xs font-medium text-white">{duration}</span>
          </div>

          {/* Play Button Overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-16 h-16 flex items-center justify-center rounded-full bg-white/25 backdrop-blur-sm border border-white/50">
              <Play className="w-8 h-8 text-white fill-white" />
            </div>
          </div>
        </div>
      </Link>

      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/videos/${id}`}>
            <h3 className="text-lg font-semibold text-gray-900 line-clamp-1 group-hover:text-blue-600 transition-colors duration-200">
              {title}
            </h3>
          </Link>
          <button 
            onClick={() => setIsLiked(!isLiked)}
            className="flex-shrink-0 p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
          >
            <Heart 
              className={`w-5 h-5 ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
            />
          </button>
        </div>

        <p className="mt-2 text-sm text-gray-500 line-clamp-2">{description}</p>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
              {author.avatarUrl ? (
                <img 
                  src={author.avatarUrl} 
                  alt={author.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-full h-full p-1.5 text-gray-400" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{author.name}</p>
              <p className="text-xs text-gray-500">{views.toLocaleString()} views</p>
            </div>
          </div>
          
          <div className="flex items-center">
            <span className="text-lg font-bold text-blue-600">${price.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}