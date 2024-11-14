// src/components/features/videos/video-upload.tsx
import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { api } from '@/lib/api';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface UploadUrlResponse {
  url: string;
  videoId: string;
  key: string;
}

export default function VideoUpload() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sellerStatus, setSellerStatus] = useState<'none' | 'pending' | 'active' | 'rejected'>('none');
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    previewUrl: ''
  });
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoKey, setVideoKey] = useState<string>('');

  // Add seller status check
  useEffect(() => {
    const checkSellerStatus = async () => {
      try {
        const response = await api.get('/api/seller/account-status');
        const data = response as { stripeConnectStatus: 'none' | 'pending' | 'active' | 'rejected' };
        setSellerStatus(data.stripeConnectStatus);
      } catch (error) {
        console.error('Error checking seller status:', error);
        setError('Failed to verify seller status');
      } finally {
        setIsCheckingStatus(false);
      }
    };

    if (user) {
      checkSellerStatus();
    }
  }, [user]);

  const handleFormChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

  const resetForm = useCallback(() => {
    setFormData({
      title: '',
      description: '',
      price: '',
      previewUrl: ''
    });
    setFile(null);
    setUploadUrl(null);
    setThumbnail(null);
    setVideoUrl(null);
    setCurrentTime(0);
    setUploadProgress(0);
    setVideoKey('');
  }, []);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.size > 100 * 1024 * 1024) {
      setError('File size must be less than 100MB');
      return;
    }

    const uniquePrefix = Date.now().toString();
    const sanitizedFileName = selectedFile.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const newVideoKey = `videos/${uniquePrefix}-${sanitizedFileName}`;
    setVideoKey(newVideoKey);

    setFile(selectedFile);
    setError(null);
    setUploadUrl(null);
    setUploadProgress(0);
    setVideoUrl(URL.createObjectURL(selectedFile));
    setThumbnail(null);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  const captureThumbnail = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context?.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    setThumbnail(canvas.toDataURL('image/jpeg'));
  }, []);

  const validateForm = useCallback(() => {
    if (!formData.title.trim()) {
      setError('Title is required');
      return false;
    }
    if (!formData.price || parseFloat(formData.price) < 0) {
      setError('Valid price is required');
      return false;
    }
    if (!thumbnail) {
      setError('Please capture a thumbnail before uploading');
      return false;
    }
    if (!file) {
      setError('Please select a video file');
      return false;
    }
    return true;
  }, [formData.title, formData.price, thumbnail, file]);

  const getUploadUrl = useCallback(async () => {
    if (!user || !file || !videoKey) {
      setError('Not authenticated or no file selected');
      return;
    }
  
    if (!validateForm()) return;
  
    setIsLoading(true);
    setError(null);
  
    try {
      // Verify seller status before proceeding
      const sellerResponse = await api.get('/api/seller/account-status');
      const sellerData = sellerResponse as { stripeConnectStatus: 'none' | 'pending' | 'active' | 'rejected' };
      if (sellerData.stripeConnectStatus !== 'active') {
        throw new Error('Your seller account must be active to upload videos');
      }

      const response = await api.post<UploadUrlResponse>('/api/videos/upload-url', {
        contentType: file.type,
        fileSize: file.size,
        videoKey
      });
  
      if (!response.url) {
        throw new Error('Invalid response format: missing URL');
      }
  
      setUploadUrl(response.url);
      setVideoKey(response.key);
  
    } catch (error) {
      console.error('Error getting upload URL:', error);
      setError(error instanceof Error ? error.message : 'Failed to get upload URL');
    } finally {
      setIsLoading(false);
    }
  }, [user, file, videoKey, validateForm]);

  const uploadFile = useCallback(async () => {
    if (!file || !uploadUrl || !videoKey) {
      console.error('Missing required upload data:', { file: !!file, uploadUrl: !!uploadUrl, videoKey: !!videoKey });
      return;
    }
  
    setIsUploading(true);
    setError(null);
    setIsSubmitting(true);
    
    try {
      // Verify seller status before proceeding
      const sellerResponse = await api.get('/api/seller/account-status');
      const sellerData = sellerResponse as { stripeConnectStatus: 'none' | 'pending' | 'active' | 'rejected' };
      if (sellerData.stripeConnectStatus !== 'active') {
        throw new Error('Your seller account must be active to upload videos');
      }

      const xhr = new XMLHttpRequest();
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      };
  
      await new Promise((resolve, reject) => {
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        
        xhr.onload = async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const token = localStorage.getItem('auth_token');
              const cloudfrontUrl = `${process.env.NEXT_PUBLIC_CLOUDFRONT_URL}/${videoKey}`;
              
              const response = await fetch('/api/videos', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  ...formData,
                  fullVideoUrl: cloudfrontUrl,
                  thumbnailUrl: thumbnail,
                  videoKey: videoKey
                })
              });
  
              if (!response.ok) {
                throw new Error(`Failed to create video record: ${response.statusText}`);
              }
  
              const data = await response.json();
              console.log('Video record created:', data);
  
              resolve(data);
            } catch (error) {
              reject(error);
            }
          } else {
            reject(new Error(`Upload failed with status: ${xhr.status}`));
          }
        };
        
        xhr.onerror = () => {
          console.error('XHR Error:', xhr.statusText);
          reject(new Error('Upload failed'));
        };
        xhr.onabort = () => reject(new Error('Upload aborted'));
        
        xhr.send(file);
      });
  
      setUploadProgress(100);
      resetForm();
  
    } catch (error) {
      console.error('Error uploading file:', error);
      setError(error instanceof Error ? error.message : 'Failed to upload file');
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
      setIsSubmitting(false);
    }
  }, [file, uploadUrl, videoKey, formData, thumbnail, resetForm]);

  if (isCheckingStatus) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  if (sellerStatus !== 'active') {
    return (
      <div className="max-w-3xl mx-auto p-4">
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <h2 className="text-2xl font-bold mb-4">Seller Account Required</h2>
          
          {sellerStatus === 'none' && (
            <>
              <p className="text-gray-600 mb-6">
                You need to set up a seller account before you can upload videos for sale.
              </p>
              <Link
                href="/seller"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Set Up Seller Account
              </Link>
            </>
          )}

          {sellerStatus === 'pending' && (
            <>
              <p className="text-gray-600 mb-6">
                Your seller account is pending verification. Please complete the Stripe onboarding process.
              </p>
              <Link
                href="/seller"
                className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
              >
                Complete Seller Setup
              </Link>
            </>
          )}

          {sellerStatus === 'rejected' && (
            <>
              <p className="text-gray-600 mb-6">
                Your seller account verification was rejected. Please contact support or try again.
              </p>
              <Link
                href="/seller"
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Review Status
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }

  // Rest of your existing return statement with the form...
  return (
    <div className="max-w-3xl mx-auto p-4">
      <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleFormChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
              disabled={isSubmitting}
            />
          </div>
  
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleFormChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={isSubmitting}
            />
          </div>
  
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Price ($) *
            </label>
            <input
              type="number"
              name="price"
              value={formData.price}
              onChange={handleFormChange}
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
              disabled={isSubmitting}
            />
          </div>
  
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Video File *
            </label>
            <input
              type="file"
              onChange={handleFileChange}
              accept="video/*"
              disabled={isUploading || isSubmitting}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                disabled:opacity-50"
              required
            />
          </div>
  
          {videoUrl && (
            <div className="space-y-4">
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full h-full"
                  controls
                  onTimeUpdate={handleTimeUpdate}
                />
              </div>
              
              <div className="flex flex-wrap items-center gap-4">
                <button
                  onClick={captureThumbnail}
                  type="button"
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded transition-colors"
                  disabled={isSubmitting}
                >
                  Capture Thumbnail
                </button>
                <span className="text-sm text-gray-500">
                  Current Time: {currentTime.toFixed(2)}s
                </span>
              </div>
  
              <canvas ref={canvasRef} className="hidden" />
  
              {thumbnail && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Thumbnail Preview
                  </h3>
                  <div className="relative aspect-video w-64 bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={thumbnail}
                      alt="Video thumbnail"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap gap-3">
          {file && !uploadUrl && (
            <button
              onClick={getUploadUrl}
              disabled={isLoading || isSubmitting || !formData.title || !formData.price || !thumbnail}
              type="button"
              className="px-4 py-2 rounded text-white transition-colors
                disabled:bg-blue-300 disabled:cursor-not-allowed
                enabled:bg-blue-500 enabled:hover:bg-blue-600"
            >
              {isLoading ? 'Getting URL...' : 'Get Upload URL'}
            </button>
          )}
  
          {uploadUrl && !isUploading && uploadProgress < 100 && (
            <button
              onClick={uploadFile}
              disabled={isSubmitting}
              type="button"
              className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white rounded transition-colors"
            >
              Upload File
            </button>
          )}
        </div>
  
        {isUploading && (
          <div className="mt-4">
            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <div>
                  <span className="text-xs font-semibold inline-block text-blue-600">
                    Upload Progress
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold inline-block text-blue-600">
                    {uploadProgress}%
                  </span>
                </div>
              </div>
              <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200">
                <div
                  style={{ width: `${uploadProgress}%` }}
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-300"
                />
              </div>
            </div>
          </div>
        )}
  
        {uploadProgress === 100 && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-green-600">Upload completed successfully!</p>
          </div>
        )}
  
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-red-600">{error}</p>
          </div>
        )}
      </form>
    </div>
  );
}