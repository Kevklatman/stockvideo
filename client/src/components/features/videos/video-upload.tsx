import { useState } from 'react';
import { useAuth } from '@/providers/auth-provider';


export default function VideoUpload() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 100 * 1024 * 1024) { // 100MB limit
        setError('File size must be less than 100MB');
        return;
      }
      setFile(selectedFile);
      setError(null);
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
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
        />
      </div>
      
      {file && (
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

      {uploadUrl && (
        <div className="mt-4">
          <p className="font-medium">Upload URL for {file?.name}:</p>
          <code className="block mt-2 p-2 bg-gray-100 rounded break-all text-sm">
            {uploadUrl}
          </code>
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