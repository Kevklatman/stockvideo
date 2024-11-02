// src/components/features/videos/video-card.tsx
'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { Play, Lock } from 'lucide-react';
import { PaymentModal } from './PaymentModal';

interface VideoCardProps {
  id: string;
  title: string;
  thumbnailUrl: string;
  videoUrl: string;
  authorName: string;
  likes: number;
  duration: number;
  views: number;
  price: string | number; // Updated to handle both string and number
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
  const [showPayment, setShowPayment] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const { user, isInitialized } = useAuth();

  const isOwner = user?.id === authorId;
  const canPlayVideo = isOwner || purchased;

  // Convert price to number for consistent handling
  const numericPrice = typeof price === 'string' ? parseFloat(price) : price;

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
      setShowPayment(true);
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
          onError={(e) => {
            console.error('Video error:', e);
            setPlaybackError('Error playing video');
          }}
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
                      ${numericPrice.toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {playbackError && (
          <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
            <div className="text-white text-center p-4">
              <p>{playbackError}</p>
              <button 
                onClick={() => {
                  setPlaybackError(null);
                  videoRef.current?.load();
                }}
                className="mt-2 px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
              >
                Retry
              </button>
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
                onClick={() => setShowPayment(true)}
              >
                Purchase
              </button>
            )}
            {!isOwner && <span>${numericPrice.toFixed(2)}</span>}
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
      
      {showPayment && (
        <PaymentModal
          videoId={id}
          price={numericPrice}
          onClose={() => {
            setShowPayment(false);
            setIsPurchasing(false);
          }}
          onSuccess={async () => {
            setIsPurchasing(true);
            try {
              await fetch(`/api/videos/${id}/verify-purchase`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
              });
              window.location.reload();
            } catch (error) {
              console.error('Error verifying purchase:', error);
              alert('Error verifying purchase. Please contact support.');
            } finally {
              setIsPurchasing(false);
              setShowPayment(false);
            }
          }}
          isLoading={isPurchasing}
        />
      )}
    </div>
  );
}