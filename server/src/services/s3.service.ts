// src/services/s3.service.ts
import { 
  S3Client, 
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';

export class S3Service {
  private s3Client: S3Client;
  private bucket: string;

  constructor() {
    // Initialize S3 client
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
      }
    });

    this.bucket = process.env.AWS_BUCKET_NAME!;
  }

  // Generate presigned URL for direct upload
  async getPresignedUploadUrl(key: string, contentType: string) {
    try {
      const { url, fields } = await createPresignedPost(this.s3Client, {
        Bucket: this.bucket,
        Key: key,
        Conditions: [
          ['content-length-range', 0, 100 * 1024 * 1024], // 100MB max
          ['starts-with', '$Content-Type', contentType],
        ],
        Expires: 3600, // 1 hour
      });

      return { url, fields };
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      throw new Error('Failed to generate upload URL');
    }
  }

  // Generate a presigned URL for video streaming
  async getSignedStreamingUrl(key: string) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      return await getSignedUrl(this.s3Client, command, {
        expiresIn: 3600 // 1 hour
      });
    } catch (error) {
      console.error('Error generating streaming URL:', error);
      throw new Error('Failed to generate streaming URL');
    }
  }

  // Delete a file from S3
  async deleteFile(key: string) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw new Error('Failed to delete file');
    }
  }

  // Get a presigned URL for direct browser upload
  async getPresignedUploadUrlForVideo(videoId: string, fileType: string) {
    const key = `videos/${videoId}/original${this.getFileExtension(fileType)}`;
    return this.getPresignedUploadUrl(key, fileType);
  }

  // Get a streaming URL for a video
  async getVideoStreamingUrl(videoId: string) {
    const key = `videos/${videoId}/processed/stream.m3u8`;
    return this.getSignedStreamingUrl(key);
  }

  // Get a thumbnail URL
  async getThumbnailUrl(videoId: string) {
    const key = `videos/${videoId}/thumbnail.jpg`;
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
  }

  private getFileExtension(contentType: string): string {
    const extensions: { [key: string]: string } = {
      'video/mp4': '.mp4',
      'video/quicktime': '.mov',
      'video/x-msvideo': '.avi'
    };
    return extensions[contentType] || '.mp4';
  }
}

// Export singleton instance
export const s3Service = new S3Service();