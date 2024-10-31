// src/components/VideoUpload.tsx
import { useState } from 'react';
import { api } from '@/lib/api';

export default function VideoUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!file) return;

    try {
      setIsUploading(true);
      setError(null);

      // Get presigned URL
      const { data } = await api.post('/videos/upload-url', {
        contentType: file.type
      });

      const { url, fields, videoId } = data;

      // Prepare form data for S3
      const formData = new FormData();
      Object.entries(fields).forEach(([key, value]) => {
        formData.append(key, value as string);
      });
      formData.append('file', file);

      // Upload to S3
      await fetch(url, {
        method: 'POST',
        body: formData,
      });

      // Create video record in your database
      await api.post('/videos', {
        videoId,
        title: file.name,
        // Add other metadata
      });

      setProgress(100);
    } catch (error) {
      console.error('Upload error:', error);
      setError('Failed to upload video');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="video/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <button 
        onClick={handleUpload}
        disabled={!file || isUploading}
      >
        Upload
      </button>
      {isUploading && (
        <div>
          <progress value={progress} max="100" />
          <span>{progress}%</span>
        </div>
      )}
      {error && <div className="text-red-500">{error}</div>}
    </div>
  );
}