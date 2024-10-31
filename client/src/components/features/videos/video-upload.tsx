import { useState, useCallback } from 'react';
import { api, ApiException } from '@/lib/api';

interface PresignedUrlData {
  url: string;
  fields: Record<string, string>;
  videoId: string;
}

interface VideoUploadState {
  status: 'idle' | 'preparing' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  error: string | null;
}

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'] as const;
type AllowedVideoType = typeof ALLOWED_VIDEO_TYPES[number];

const MAX_FILE_SIZE = 1024 * 1024 * 500; // 500MB

export default function VideoUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<VideoUploadState>({
    status: 'idle',
    progress: 0,
    error: null,
  });

  const validateFile = useCallback((file: File) => {
    if (!ALLOWED_VIDEO_TYPES.includes(file.type as AllowedVideoType)) {
      throw new Error('Invalid file type. Please select an MP4, MOV, or AVI file.');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File size exceeds 500MB limit.');
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setUploadState({ status: 'idle', progress: 0, error: null });

    if (selectedFile) {
      try {
        validateFile(selectedFile);
        setFile(selectedFile);
      } catch (error) {
        setFile(null);
        setUploadState({
          status: 'error',
          progress: 0,
          error: error instanceof Error ? error.message : 'Invalid file',
        });
      }
    }
  }, [validateFile]);

  const handleUpload = async () => {
    if (!file) return;

    try {
      setUploadState({ status: 'preparing', progress: 0, error: null });

      // Get presigned URL
      const uploadData = await api.post<PresignedUrlData>('/videos/upload-url', {
        contentType: file.type,
      });

      // Prepare form data for S3
      const formData = new FormData();
      Object.entries(uploadData.fields).forEach(([key, value]) => {
        formData.append(key, value);
      });
      formData.append('file', file);

      setUploadState(prev => ({ ...prev, status: 'uploading' }));

      // Upload to S3 with progress tracking
      await api.post(uploadData.url, formData, {
        skipAuth: true, // S3 doesn't need our auth token
        onUploadProgress: (event) => {
          const progress = Math.round((event.loaded * 100) / event.total);
          setUploadState(prev => ({ ...prev, progress }));
        },
      });

      setUploadState({
        status: 'completed',
        progress: 100,
        error: null,
      });

    } catch (error) {
      console.error('Upload error:', error);
      let errorMessage = 'Failed to upload video';
      
      if (error instanceof ApiException) {
        errorMessage = error.message;
      }

      setUploadState({
        status: 'error',
        progress: 0,
        error: errorMessage,
      });
    }
  };

  return (
    <div className="space-y-4 max-w-md mx-auto p-4">
      <div className="flex flex-col gap-2">
        <label 
          htmlFor="video-upload" 
          className="text-sm font-medium text-gray-700"
        >
          Select Video File
        </label>
        <input
          id="video-upload"
          type="file"
          accept={ALLOWED_VIDEO_TYPES.join(',')}
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-full file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
          disabled={uploadState.status === 'uploading'}
        />
      </div>

      {file && (
        <div className="text-sm text-gray-600">
          Selected file: {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
        </div>
      )}

      <button 
        onClick={handleUpload}
        disabled={!file || uploadState.status === 'uploading'}
        className={`w-full px-4 py-2 rounded-lg transition-colors
          ${!file || uploadState.status === 'uploading'
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
      >
        {uploadState.status === 'uploading' ? 'Uploading...' : 'Upload Video'}
      </button>

      {uploadState.status !== 'idle' && uploadState.status !== 'error' && (
        <div className="space-y-2">
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
              style={{ width: `${uploadState.progress}%` }}
            />
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>{uploadState.status.charAt(0).toUpperCase() + uploadState.status.slice(1)}</span>
            <span>{uploadState.progress}%</span>
          </div>
        </div>
      )}

      {uploadState.error && (
        <div className="p-3 rounded bg-red-50 border border-red-200">
          <p className="text-sm text-red-600">
            {uploadState.error}
          </p>
        </div>
      )}
    </div>
  );
}