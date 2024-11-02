'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { Play, Lock } from 'lucide-react';

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
  const [isHovering, setIsHovering] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
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

  const handleVideoClick = async () => {
    if (!isInitialized) return;

    if (!user) {
      alert('Please sign in to watch this video');
      return;
    }

    if (!canPlayVideo) {
      alert('Please purchase this video to watch it');
      return;
    }

    setShowControls(true);
    setIsPlaying(true);
    videoRef.current?.play();
  };

  const handleVideoEnd = () => {
    setIsPlaying(false);
    setShowControls(false);
  };

  const handleVideoPause = () => {
    setIsPlaying(false);
  };

  return (
    <div className="rounded-lg overflow-hidden shadow-lg bg-black">
      <div 
        className="relative aspect-video bg-gray-900"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => {
          setIsHovering(false);
          if (!isPlaying) setShowControls(false);
        }}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          controls={showControls}
          src={videoUrl}
          poster={thumbnailUrl}
          preload="metadata"
          onEnded={handleVideoEnd}
          onPause={handleVideoPause}
          onPlay={() => {
            setIsPlaying(true);
            setShowControls(true);
          }}
        >
          Your browser does not support the video tag.
        </video>

        {(!isPlaying || !showControls) && (
          <div 
            onClick={() => {
              if (canPlayVideo) {
                setShowControls(true);
                videoRef.current?.play();
              } else {
                handleVideoClick();
              }
            }} 
            className="absolute inset-0 cursor-pointer group"
          >
            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/60 transition-colors" />
            
            {thumbnailUrl && (
              <img
                src={thumbnailUrl}
                alt={title}
                className="w-full h-full object-cover"
              />
            )}

            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`rounded-full p-4 transition-transform duration-300 ${
                isHovering ? 'scale-110' : 'scale-100'
              }`}>
                {canPlayVideo ? (
                  <Play size={48} className="text-white" />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Lock size={32} className="text-white" />
                    <div className="text-white text-lg font-medium px-4 py-2 bg-blue-600 rounded">
                      ${price}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 text-white">
        <h3 className="font-semibold text-lg mb-2">{title}</h3>
        <p className="text-gray-300 text-sm mb-2">{description}</p>
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>{authorName}</span>
          <div className="flex items-center space-x-4">
            {user && !canPlayVideo && (
              <button 
                className="text-blue-400 hover:text-blue-300 transition-colors"
                onClick={() => {
                  console.log('Purchase video:', id);
                }}
              >
                Purchase
              </button>
            )}
            {!isOwner && <span>${price}</span>}
          </div>
        </div>
        <div className="text-xs text-gray-500 mt-2">
          {formatDate(createdAt)}
        </div>
        {isOwner && (
          <div className="mt-2 text-xs text-green-400">
            You own this video
          </div>
        )}
        {purchased && !isOwner && (
          <div className="mt-2 text-xs text-blue-400">
            Purchased
          </div>
        )}
      </div>
    </div>
  );
}