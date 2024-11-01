// src/components/features/videos/video-card.tsx
'use client';

import { useState } from 'react';

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
}

export function VideoCard({
  title,
  thumbnailUrl,
  videoUrl,
  authorName,
  price,
  description,
  createdAt,
}: VideoCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="rounded-lg overflow-hidden shadow-lg bg-white">
      <div className="relative aspect-video bg-gray-100">
        {isPlaying ? (
          <video
            className="w-full h-full object-cover"
            controls
            src={videoUrl}
          >
            Your browser does not support the video tag.
          </video>
        ) : (
          <div 
            onClick={() => setIsPlaying(true)} 
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
                <span className="text-gray-400">Click to play video</span>
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-black bg-opacity-50 rounded-full p-4">
                <svg
                  className="w-8 h-8 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
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
          <span>${price}</span>
        </div>
        <div className="text-xs text-gray-400 mt-2">
          {formatDate(createdAt)}
        </div>
      </div>
    </div>
  );
}