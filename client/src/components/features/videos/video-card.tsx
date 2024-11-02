'use client';

import { useState } from 'react';
import { useAuth } from '@/providers/auth-provider';

interface VideoCardProps {
  id: string;
  title: string;
  thumbnailUrl: string;
  videoUrl: string;
  authorName: string;
  likes: number;
  duration: number;
  views: number;
  price: string;
  description: string;
  createdAt: Date;
  authorId: string;
  purchased?: boolean;
}

export function VideoCard({
  id,
  title,
  thumbnailUrl,
  videoUrl,
  authorName,
  price,
  description,
  createdAt,
  authorId,
  purchased = false,
}: VideoCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const { user, isInitialized } = useAuth();

  const isOwner = user?.id === authorId;
  const canPlayVideo = isOwner || purchased;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleVideoClick = () => {
    if (!isInitialized) {
      return; // Wait for auth to initialize
    }

    if (!user) {
      alert('Please sign in to watch this video');
      return;
    }

    if (!canPlayVideo) {
      alert('Please purchase this video to watch it');
      return;
    }

    setIsPlaying(true);
  };

  return (
    <div className="rounded-lg overflow-hidden shadow-lg bg-white">
      <div className="relative aspect-video bg-gray-100">
        {isPlaying && canPlayVideo ? (
          <video
            className="w-full h-full object-cover"
            controls
            src={videoUrl}
          >
            Your browser does not support the video tag.
          </video>
        ) : (
          <div 
            onClick={handleVideoClick} 
            className="cursor-pointer w-full h-full relative"
          >
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-200">
                <span className="text-gray-400">
                  {!isInitialized ? 'Loading...' : 
                    canPlayVideo ? 'Click to play video' : 'Purchase to watch'}
                </span>
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-black bg-opacity-50 rounded-full p-4">
                {canPlayVideo ? (
                  <svg
                    className="w-8 h-8 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                ) : (
                  <div className="text-white text-sm font-medium px-3 py-1">
                    ${price}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-lg mb-2">{title}</h3>
        <p className="text-gray-600 text-sm mb-2">{description}</p>
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{authorName}</span>
          <div className="flex items-center space-x-2">
            {user && !canPlayVideo && (
              <button 
                className="text-blue-500 hover:text-blue-600 cursor-pointer"
                onClick={() => {
                  // Implement purchase functionality
                  console.log('Purchase video:', id);
                }}
              >
                Purchase
              </button>
            )}
            <span>${price}</span>
          </div>
        </div>
        <div className="text-xs text-gray-400 mt-2">
          {formatDate(createdAt)}
        </div>
        {isOwner && (
          <div className="mt-2 text-xs text-green-500">
            You own this video
          </div>
        )}
        {purchased && !isOwner && (
          <div className="mt-2 text-xs text-blue-500">
            Purchased
          </div>
        )}
      </div>
    </div>
  );
}