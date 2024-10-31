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

  const getUploadUrl = async (contentType: string) => {
    if (!user) {
      setError('Not authenticated');
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
          fileSize: file?.size
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
        
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.response);
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
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Video File
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
        />
      </div>
      
      <div className="space-x-3">
        {file && !uploadUrl && (
          <button
            onClick={() => getUploadUrl(file.type)}
            disabled={isLoading}
            className={`px-4 py-2 rounded text-white ${
              isLoading 
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