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
}

export function VideoCard({
  title,
  thumbnailUrl,
  videoUrl,
  authorName,
  likes,
  views,
}: VideoCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="rounded-lg overflow-hidden shadow-lg">
      <div className="relative aspect-video">
        {isPlaying ? (
          <video
            className="w-full h-full object-cover"
            controls
            autoPlay
            src={videoUrl}
          >
            Your browser does not support the video tag.
          </video>
        ) : (
          <div onClick={() => setIsPlaying(true)} className="cursor-pointer">
            <img
              src={thumbnailUrl}
              alt={title}
              className="w-full h-full object-cover"
            />
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
        <p className="text-gray-600">{authorName}</p>
        <div className="flex items-center text-sm text-gray-500 mt-2">
          <span>{views} views</span>
          <span className="mx-2">•</span>
          <span>{likes} likes</span>
        </div>
      </div>
    </div>
  );
}