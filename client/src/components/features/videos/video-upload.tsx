// src/components/features/videos/video-upload.tsx
import { useAuth } from '@/providers/auth-provider';
import { useState } from 'react';

interface UploadResponse {
  status: string;
  data: {
    url: string;
    videoId: string;
    key: string;
  }
}

interface VideoUploadState {
  status: 'idle' | 'preparing' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  error: string | null;
}

const CHUNK_SIZE = 1 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
const MAX_FILE_SIZE = 100 * 1024 * 1024;

export default function VideoUpload() {
  const { user, isLoading } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<VideoUploadState>({
    status: 'idle',
    progress: 0,
    error: null,
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    
    if (!selectedFile) {
      setUploadState(prev => ({ ...prev, error: 'No file selected' }));
      return;
    }

    if (!ALLOWED_VIDEO_TYPES.includes(selectedFile.type)) {
      setUploadState(prev => ({
        ...prev,
        error: 'Invalid file type. Please upload MP4, MOV, or AVI files only.'
      }));
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setUploadState(prev => ({
        ...prev,
        error: 'File size exceeds 100MB limit'
      }));
      return;
    }

    setFile(selectedFile);
    setUploadState({ status: 'idle', progress: 0, error: null });
  };

  const uploadChunk = async (
    chunk: Blob,
    chunkIndex: number,
    totalChunks: number,
    uploadUrl: string
  ) => {
    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('chunkIndex', chunkIndex.toString());
    formData.append('totalChunks', totalChunks.toString());

    const token = localStorage.getItem('auth_token');
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to upload chunk ${chunkIndex + 1}`);
    }

    return response;
  };

  const handleUpload = async () => {
    if (!file || !user) {
      setUploadState(prev => ({
        ...prev,
        error: !user ? 'Please sign in to upload videos' : 'No file selected'
      }));
      return;
    }

    try {
      setUploadState(prev => ({ ...prev, status: 'preparing', progress: 0 }));

      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/videos/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to get upload URL: ${response.statusText}`);
      }

      const uploadUrlResponse: UploadResponse = await response.json();

      if (uploadUrlResponse.status !== 'success' || !uploadUrlResponse.data) {
        throw new Error('Invalid upload URL response');
      }

      setUploadState(prev => ({ ...prev, status: 'uploading' }));

      const chunks: Blob[] = [];
      let offset = 0;
      while (offset < file.size) {
        const chunk = file.slice(offset, offset + CHUNK_SIZE);
        chunks.push(chunk);
        offset += CHUNK_SIZE;
      }

      for (let i = 0; i < chunks.length; i++) {
        await uploadChunk(
          chunks[i], 
          i, 
          chunks.length, 
          uploadUrlResponse.data.url
        );
        const progress = Math.round(((i + 1) / chunks.length) * 100);
        setUploadState(prev => ({ ...prev, progress }));
      }

      setUploadState(prev => ({ ...prev, status: 'processing' }));
      const finalizeResponse = await fetch('/api/videos/finalize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          videoId: uploadUrlResponse.data.videoId,
          key: uploadUrlResponse.data.key,
          metadata: {
            title: file.name.split('.')[0],
            contentType: file.type,
            size: file.size,
          }
        })
      });

      if (!finalizeResponse.ok) {
        throw new Error('Failed to finalize upload');
      }

      setUploadState({
        status: 'completed',
        progress: 100,
        error: null,
      });

    } catch (error) {
      console.error('Upload error:', error);
      setUploadState({
        status: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : 'Failed to upload video',
      });
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-4">
      {!user && (
        <p className="text-red-500 mb-4">Please sign in to upload videos</p>
      )}
      
      <input
        type="file"
        accept={ALLOWED_VIDEO_TYPES.join(',')}
        onChange={handleFileChange}
        className="mb-4"
        disabled={!user}
      />
      
      {file && user && (
        <button
          onClick={handleUpload}
          disabled={uploadState.status === 'uploading' || uploadState.status === 'processing'}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400"
        >
          Upload Video
        </button>
      )}

      {uploadState.status !== 'idle' && (
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded">
            <div
              className="bg-blue-500 h-2 rounded"
              style={{ width: `${uploadState.progress}%` }}
            />
          </div>
          <p className="mt-2">
            Status: {uploadState.status} {uploadState.progress}%
          </p>
        </div>
      )}

      {uploadState.error && (
        <p className="mt-4 text-red-500">{uploadState.error}</p>
      )}
    </div>
  );
}