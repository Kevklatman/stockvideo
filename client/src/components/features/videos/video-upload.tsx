import { useState } from 'react';
import { useAuth } from '@/providers/auth-provider';

export default function VideoUpload() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);

  // New form data states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState('');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 100 * 1024 * 1024) {
        setError('File size must be less than 100MB');
        return;
      }
      setFile(selectedFile);
      setError(null);
      setUploadUrl(null);
      setUploadProgress(0);
    }
  };

  const validateForm = () => {
    if (!title.trim()) {
      setError('Title is required');
      return false;
    }
    if (!price || parseFloat(price) < 0) {
      setError('Valid price is required');
      return false;
    }
    return true;
  };

  const getUploadUrl = async (contentType: string) => {
    if (!user) {
      setError('Not authenticated');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/videos/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          filename: file?.name,
          contentType: contentType,
          fileSize: file?.size,
          title,
          description,
          price: parseFloat(price),
          previewUrl
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Failed to get upload URL: ${response.statusText}`);
      }

      if (data.status !== 'success' || !data.data?.url) {
        throw new Error('Invalid response format from server');
      }

      setUploadUrl(data.data.url);

    } catch (error) {
      console.error('Error getting upload URL:', error);
      setError(error instanceof Error ? error.message : 'Failed to get upload URL');
    } finally {
      setIsLoading(false);
    }
  };

  const uploadFile = async () => {
    if (!file || !uploadUrl) return;

    setIsUploading(true);
    setError(null);
    
    try {
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
              // After successful upload, create the video record
              const token = localStorage.getItem('auth_token');
              const response = await fetch('/api/videos', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  title,
                  description,
                  price: parseFloat(price),
                  previewUrl,
                  fullVideoUrl: uploadUrl // or get the final URL from the server response
                })
              });

              if (!response.ok) {
                throw new Error('Failed to create video record');
              }

              resolve(xhr.response);
            } catch (error) {
              reject(error);
            }
          } else {
            reject(new Error(`Upload failed with status: ${xhr.status}`));
          }
        };
        
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.onabort = () => reject(new Error('Upload aborted'));
        
        xhr.send(file);
      });

      setUploadProgress(100);
      setError(null);

      // Reset form after successful upload
      setTitle('');
      setDescription('');
      setPrice('');
      setPreviewUrl('');
      setFile(null);
      setUploadUrl(null);

    } catch (error) {
      console.error('Error uploading file:', error);
      setError(error instanceof Error ? error.message : 'Failed to upload file');
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  if (!user) {
    return <div className="p-4 text-red-500">Please log in to upload videos</div>;
  }

  return (
    <div className="p-4">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Price ($) *
          </label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            step="0.01"
            min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Preview URL
          </label>
          <input
            type="url"
            value={previewUrl}
            onChange={(e) => setPreviewUrl(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Enter preview video URL"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Video File *
          </label>
          <input
            type="file"
            onChange={handleFileChange}
            accept="video/*"
            disabled={isUploading}
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
      </div>
      
      <div className="space-x-3 mt-6">
        {file && !uploadUrl && (
          <button
            onClick={() => getUploadUrl(file.type)}
            disabled={isLoading || !title || !price}
            className={`px-4 py-2 rounded text-white ${
              isLoading || !title || !price
                ? 'bg-blue-300 cursor-not-allowed' 
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {isLoading ? 'Getting URL...' : 'Get Upload URL'}
          </button>
        )}

        {uploadUrl && !isUploading && uploadProgress < 100 && (
          <button
            onClick={uploadFile}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded"
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
    </div>
  );
}