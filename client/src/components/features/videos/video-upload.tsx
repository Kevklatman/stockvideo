import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, X, FileText, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Toast } from '@/components/Toast';

interface VideoFormData {
  title: string;
  description: string;
  price: string;
}

interface UploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
  success: boolean;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
const INITIAL_UPLOAD_STATE: UploadState = {
  isUploading: false,
  progress: 0,
  error: null,
  success: false
};

export default function VideoUpload() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  
  // File state
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>(INITIAL_UPLOAD_STATE);
  
  // Form state
  const [formData, setFormData] = useState<VideoFormData>({
    title: '',
    description: '',
    price: ''
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [preview]);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Invalid file type. Only MP4, MOV, and AVI formats are allowed.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File size should not exceed 100MB';
    }
    return null;
  };

  const handleFileSelect = useCallback((selectedFile: File) => {
    const error = validateFile(selectedFile);
    
    if (error) {
      setUploadState(prev => ({ ...prev, error }));
      return;
    }

    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setFile(selectedFile);
    setUploadState(prev => ({ ...prev, error: null }));
    
    const url = URL.createObjectURL(selectedFile);
    setPreview(url);
  }, [preview]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const resetForm = () => {
    setFile(null);
    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }
    setFormData({
      title: '',
      description: '',
      price: ''
    });
    setUploadState(INITIAL_UPLOAD_STATE);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file || uploadState.isUploading) return;
  
    try {
      setUploadState(prev => ({
        ...prev,
        isUploading: true,
        error: null,
        progress: 0,
        success: false
      }));
  
      // Get presigned URL with short expiration
      const response = await api.post<{ fields: Record<string, string>; url: string }>('/videos/upload-url', {
        filename: file.name,
        contentType: file.type, // Add content type
        ...formData
      });
  
      const { fields, url } = response;
  
      // Construct FormData exactly as required by S3
      const formDataToSend = new FormData();
      // Add S3 fields first
      Object.entries(fields).forEach(([key, value]) => {
        formDataToSend.append(key, value as string);
      });
      // Add file last
      formDataToSend.append('file', file);
  
      // Upload to S3 with proper headers
      const uploadResponse = await fetch(url, {
        method: 'POST',
        body: formDataToSend,
        // Don't set Content-Type header - browser will set it with boundary
      });
  
      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }
  
      // Continue with processing...
      startProcessing(fields.key);
  
    } catch (error) {
      console.error('Upload error:', error);
      setUploadState(prev => ({
        ...prev,
        isUploading: false,
        error: error instanceof Error ? error.message : 'Failed to upload video',
        progress: 0
      }));
    }
  };

  const startProcessing = async (fileKey: string) => {
    // Get authentication token - adjust according to your auth method
    // const token = localStorage.getItem('auth_token'); // or however you store your auth token
  
    // Create URL with authentication
    const params = new URLSearchParams({
      key: fileKey,
      // Add any other necessary params
    });
  
    eventSourceRef.current = new EventSource(
      `/api/videos/upload/process?${params}`,
      { withCredentials: true }
    );
  
    eventSourceRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.error) {
          console.error('Processing error:', data.error);
          setUploadState(prev => ({
            ...prev,
            isUploading: false,
            error: data.error,
            progress: 0
          }));
          eventSourceRef.current?.close();
          return;
        }
  
        if (data.progress !== undefined) {
          setUploadState(prev => ({
            ...prev,
            progress: data.progress
          }));
        }
  
        if (data.status === 'complete') {
          setUploadState(prev => ({
            ...prev,
            isUploading: false,
            success: true,
            progress: 100
          }));
          eventSourceRef.current?.close();
          
          setTimeout(() => {
            router.push(`/videos/${data.video.id}`);
          }, 1500);
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    };
  
    eventSourceRef.current.onerror = (error) => {
      console.error('SSE error:', error);
      setUploadState(prev => ({
        ...prev,
        isUploading: false,
        error: 'Connection lost. Please try again.',
        progress: 0
      }));
      eventSourceRef.current?.close();
    };
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Upload Video</h1>

      {uploadState.success && (
        <Toast
          message="Video uploaded successfully! Redirecting..."
          type="success"
          duration={1500}
        />
      )}

      {uploadState.error && (
        <Toast
          message={uploadState.error}
          type="error"
          onClose={() => setUploadState(prev => ({ ...prev, error: null }))}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Upload Area */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-lg p-8 text-center
            ${uploadState.error ? 'border-red-400 bg-red-50' : 'border-gray-300 hover:border-blue-400'}
            transition-colors duration-200`}
        >
          {/* Loading Overlay */}
          {uploadState.isUploading && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  Uploading... {uploadState.progress}%
                </p>
              </div>
            </div>
          )}

          {!file && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <Upload className="h-12 w-12 text-gray-400" />
              </div>
              <div>
                <p className="text-lg text-gray-700">
                  Drag and drop your video here, or
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Browse Files
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept={ALLOWED_TYPES.join(',')}
                  onChange={handleInputChange}
                />
              </div>
              <p className="text-sm text-gray-500">
                MP4, MOV, or AVI (max. 100MB)
              </p>
            </div>
          )}

          {file && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileText className="h-6 w-6 text-blue-600" />
                  <span className="text-gray-700">{file.name}</span>
                </div>
                <button
                  type="button"
                  onClick={resetForm}
                  className="p-1 hover:bg-gray-100 rounded-full"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              {preview && (
                <video
                  src={preview}
                  controls
                  className="w-full rounded-lg"
                />
              )}
            </div>
          )}
        </div>

        {/* Video Details Form */}
        <div className="space-y-4 bg-white rounded-lg p-6 shadow-sm">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              id="title"
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter video title"
              disabled={uploadState.isUploading}
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe your video"
              disabled={uploadState.isUploading}
            />
          </div>

          <div>
            <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
              Price ($)
            </label>
            <input
              type="number"
              id="price"
              required
              min="0"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter price"
              disabled={uploadState.isUploading}
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!file || uploadState.isUploading}
          className={`w-full py-3 px-4 rounded-md text-white font-medium
            ${!file || uploadState.isUploading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700'}
            transition-colors duration-200`}
        >
          {uploadState.isUploading ? `Uploading... ${uploadState.progress}%` : 'Upload Video'}
        </button>
      </form>
    </div>
  );
}