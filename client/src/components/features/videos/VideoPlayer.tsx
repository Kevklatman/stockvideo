import { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Rewind, FastForward, Settings } from 'lucide-react';
import { api, VideoUrls } from '@/lib/api';

interface VideoPlayerProps {
  videoId: string;
  initialUrls?: VideoUrls;
  previewMode?: boolean;
  isPurchased?: boolean;
  onPurchaseClick?: () => void;
  url?: string;
  thumbnailUrl: string; // Add this line

}

export default function VideoPlayer({ 
  videoId, 
  initialUrls,
  previewMode = false, 
  isPurchased = false, 
  onPurchaseClick 
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const progressBarRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => {
    const savedVolume = localStorage.getItem('videoPlayerVolume');
    return savedVolume ? parseFloat(savedVolume) : 1;
  });
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('videoPlayerMuted') === 'true';
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [videoUrls, setVideoUrls] = useState<VideoUrls | undefined>(initialUrls);
  const [buffered, setBuffered] = useState<TimeRanges | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const playbackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  useEffect(() => {
    const initializeVideo = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (!videoRef.current) return;

        if (!videoUrls) {
          const urls = await api.videos.getUrls(videoId);
          setVideoUrls(urls);
        }

        const video = videoRef.current;
        
        video.volume = volume;
        video.muted = isMuted;
        video.playbackRate = playbackRate;

        const handleLoaded = () => {
          setIsLoading(false);
          setDuration(video.duration);
        };

        const handleError = (e: Event) => {
          console.error('Video error:', e);
          setError('Failed to load video');
          setIsLoading(false);
        };

        const handleProgress = () => {
          setBuffered(video.buffered);
        };

        const handleEnded = () => {
          setIsPlaying(false);
          setShowControls(true);
        };

        video.addEventListener('loadedmetadata', handleLoaded);
        video.addEventListener('error', handleError);
        video.addEventListener('progress', handleProgress);
        video.addEventListener('ended', handleEnded);

        if (isPurchased || !previewMode) {
          video.src = videoUrls?.streamingUrl || '';
        } else {
          video.src = videoUrls?.previewUrl || '';
        }

        await video.load();

        return () => {
          video.removeEventListener('loadedmetadata', handleLoaded);
          video.removeEventListener('error', handleError);
          video.removeEventListener('progress', handleProgress);
          video.removeEventListener('ended', handleEnded);
        };
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
  }, [videoId, previewMode, isPurchased, videoUrls, volume, isMuted, playbackRate]);

  useEffect(() => {
    localStorage.setItem('videoPlayerVolume', volume.toString());
    localStorage.setItem('videoPlayerMuted', isMuted.toString());
  }, [volume, isMuted]);

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

  const skipTime = (seconds: number) => {
    if (videoRef.current) {
      const newTime = videoRef.current.currentTime + seconds;
      videoRef.current.currentTime = Math.max(0, Math.min(newTime, duration));
    }
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (!videoRef.current) return;

    switch (e.key.toLowerCase()) {
      case ' ':
      case 'k':
        e.preventDefault();
        togglePlay();
        break;
      case 'm':
        toggleMute();
        break;
      case 'f':
        toggleFullscreen();
        break;
      case 'arrowleft':
        skipTime(-10);
        break;
      case 'arrowright':
        skipTime(10);
        break;
      case 'arrowup':
        e.preventDefault();
        handleVolumeChange({
          target: { value: Math.min(volume + 0.1, 1) },
          currentTarget: { value: Math.min(volume + 0.1, 1) }
        } as unknown as React.ChangeEvent<HTMLInputElement>);
        break;
      case 'arrowdown':
        e.preventDefault();
        handleVolumeChange({ target: { value: Math.max(volume - 0.1, 0) }} as never);
        break;
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [volume, isPlaying]);

  const hideControlsTimeout = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (!isHovering) {
      controlsTimeoutRef.current = setTimeout(() => {
        if (isPlaying) {
          setShowControls(false);
          setShowSettings(false);
        }
      }, 2000);
    }
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

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

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !videoRef.current) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
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

  const handlePlaybackRateChange = (rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
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
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      ref={videoContainerRef}
      className="relative group bg-black rounded-lg overflow-hidden"
      onMouseEnter={() => {
        setIsHovering(true);
        setShowControls(true);
      }}
      onMouseMove={() => {
        setShowControls(true);
        hideControlsTimeout();
      }}
      onMouseLeave={() => {
        setIsHovering(false);
        setShowControls(false);
        setShowSettings(false);
        if (controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current);
        }
      }}
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
        className="w-full aspect-video cursor-pointer"
        poster={videoUrls?.thumbnailUrl}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onClick={togglePlay}
        playsInline
        preload="metadata"
      >
        <source src={videoUrls?.streamingUrl} type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      <div 
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 transition-opacity duration-300 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div 
          ref={progressBarRef}
          className="relative w-full h-1 bg-gray-600 rounded-lg cursor-pointer"
          onClick={handleProgressBarClick}
        >
          {buffered && Array.from(Array(buffered.length).keys()).map((i) => {
            const start = (buffered.start(i) / duration) * 100;
            const end = (buffered.end(i) / duration) * 100;
            return (
              <div
                key={i}
                className="absolute h-full bg-gray-400 rounded-lg"
                style={{ left: `${start}%`, width: `${end - start}%` }}
              />
            );
          })}
          
          <input
            type="range"
            className="absolute w-full h-full opacity-0 cursor-pointer"
            min={0}
            max={duration}
            value={currentTime}
            onChange={handleSeek}
          />
          <div
            className="absolute h-full bg-blue-500 rounded-lg"
            style={{ width: `${(currentTime / duration) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-4">
            <button 
              onClick={togglePlay} 
              className="text-white hover:text-gray-300 transition-colors"
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>

            <button 
              onClick={() => skipTime(-10)} 
              className="text-white hover:text-gray-300 transition-colors"
            >
              <Rewind size={20} />
            </button>

            <button 
              onClick={() => skipTime(10)} 
              className="text-white hover:text-gray-300 transition-colors"
            >
              <FastForward size={20} />
            </button>

            <div className="flex items-center gap-2">
              <button 
                onClick={toggleMute} 
                className="text-white hover:text-gray-300 transition-colors"
              >
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

          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className="text-white hover:text-gray-300 transition-colors"
              >
                <Settings size={24} />
              </button>

              {showSettings && (
                <div className="absolute bottom-full right-0 mb-2 bg-black/90 rounded-lg p-2 min-w-[200px]">
                  <div className="text-white text-sm">
                    <p className="px-2 py-1 text-gray-400">Playback Speed</p>
                    {playbackRates.map(rate => (
                      <button
                        key={rate}
                        onClick={() => handlePlaybackRateChange(rate)}
                        className={`w-full text-left px-2 py-1 hover:bg-white/10 rounded ${
                          playbackRate === rate ? 'text-blue-500' : 'text-white'
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={toggleFullscreen} 
              className="text-white hover:text-gray-300 transition-colors"
            >
              {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
            </button>
          </div>
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