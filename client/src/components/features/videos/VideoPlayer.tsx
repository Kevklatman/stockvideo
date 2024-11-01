import { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';
import { api } from '@/lib/api';

interface VideoPlayerProps {
  videoId: string;
  url: string;
  thumbnailUrl: string;
  previewMode?: boolean;
  isPurchased?: boolean;
  onPurchaseClick?: () => void;
}

export default function VideoPlayer({ 
  videoId, 
  url, 
  thumbnailUrl, 
  previewMode = false, 
  isPurchased = false, 
  onPurchaseClick 
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    const initializeVideo = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (videoRef.current) {
          videoRef.current.load();
          
          if (url && (isPurchased || !previewMode)) {
            const video = videoRef.current;
            
            const handleLoaded = () => {
              setIsLoading(false);
              setDuration(video.duration);
            };

            const handleError = (e: Event) => {
              console.error('Video error:', e);
              setError('Failed to load video');
              setIsLoading(false);
            };

            video.addEventListener('loadedmetadata', handleLoaded);
            video.addEventListener('error', handleError);

            video.src = url;
            await video.load();

            return () => {
              video.removeEventListener('loadedmetadata', handleLoaded);
              video.removeEventListener('error', handleError);
            };
          } else {
            const endpoint = previewMode 
              ? `/api/videos/${videoId}/preview`
              : `/api/videos/${videoId}/stream`;

            const response = await api.get<{ url: string }>(endpoint);
            videoRef.current.src = response.url;
            await videoRef.current.load();
          }
        }
      } catch (error) {
        setError('Failed to load video');
        console.error('Video loading error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeVideo();

    return () => {
      if (videoRef.current) {
        videoRef.current.src = '';
      }
    };
  }, [videoId, previewMode, url, isPurchased]);

  const togglePlay = async () => {
    if (videoRef.current) {
      try {
        if (isPlaying) {
          await videoRef.current.pause();
        } else {
          await videoRef.current.play();
        }
        setIsPlaying(!isPlaying);
      } catch (error) {
        console.error('Error toggling play state:', error);
        setError('Failed to play video');
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMutedState = !isMuted;
      videoRef.current.muted = newMutedState;
      setIsMuted(newMutedState);
      if (newMutedState) {
        setVolume(0);
      } else {
        setVolume(1);
        videoRef.current.volume = 1;
      }
    }
  };

  const toggleFullscreen = async () => {
    if (!videoContainerRef.current) return;

    try {
      if (!isFullscreen) {
        if (videoContainerRef.current.requestFullscreen) {
          await videoContainerRef.current.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      ref={videoContainerRef}
      className="relative group bg-black rounded-lg overflow-hidden"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {error && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-30">
          <div className="text-white text-center">
            <p className="mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {previewMode && !isPurchased && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
          <button
            onClick={onPurchaseClick}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Purchase to Watch Full Video
          </button>
        </div>
      )}

      <video
        ref={videoRef}
        className="w-full aspect-video"
        poster={thumbnailUrl}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        playsInline
        preload="metadata"
      >
        <source src={url} type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      {/* Video Controls */}
      <div 
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 transition-opacity duration-300 ${
          showControls || isPlaying ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Progress bar */}
        <input
          type="range"
          className="w-full h-1 bg-gray-400 rounded-lg appearance-none cursor-pointer"
          min={0}
          max={duration}
          value={currentTime}
          onChange={handleSeek}
        />

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-4">
            <button onClick={togglePlay} className="text-white hover:text-gray-300">
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>

            <div className="flex items-center gap-2">
              <button onClick={toggleMute} className="text-white hover:text-gray-300">
                {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
              </button>
              <input
                type="range"
                className="w-20 h-1 bg-gray-400 rounded-lg appearance-none cursor-pointer"
                min={0}
                max={1}
                step={0.1}
                value={volume}
                onChange={handleVolumeChange}
              />
            </div>

            <span className="text-white text-sm">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <button onClick={toggleFullscreen} className="text-white hover:text-gray-300">
            {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}