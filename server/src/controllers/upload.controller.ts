import { Request, Response } from 'express';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fromEnv } from '@aws-sdk/credential-providers';

dotenv.config();

// Constants
const BUCKET_NAME = process.env.AWS_BUCKET_NAME!;
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
const UPLOAD_URL_EXPIRATION = 3600; // 1 hour in seconds

// S3 Client initialization
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: fromEnv()
});

// Types
interface VideoMetadata {
  title?: string;
  description?: string;
  duration?: number;
  resolution?: string;
  fileSize?: number;
  [key: string]: any;
}

export class UploadController {
  static async getUploadUrl(req: Request, res: Response) {
    try {
      const { contentType, fileSize } = req.body;
  
      if (!contentType) {
        return res.status(400).json({
          status: 'error',
          message: 'Content type is required'
        });
      }
  
      const videoId = crypto.randomUUID();
      const key = `videos/${videoId}`;
  
      // Create the command for S3
      const command = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME!, // Make sure this env var is set
        Key: key,
        ContentType: contentType,
        Metadata: {
          uploadedAt: new Date().toISOString()
        }
      });
  
      const url = await getSignedUrl(s3Client, command, { 
        expiresIn: 3600 
      });
  
      // Return data in the expected format
      res.json({
        status: 'success',
        data: {
          url,
          videoId,
          key
        }
      });
    } catch (error) {
      console.error('Upload URL generation error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to generate upload URL'
      });
    }
  }

  static async createVideoRecord(req: Request, res: Response) {
    try {
      const { videoId, key } = req.body;

      // Validate required fields
      if (!videoId || !key) {
        return res.status(400).json({
          status: 'error',
          message: 'VideoId and key are required'
        });
      }

      // Validate video ID format
      if (!this.isValidUUID(videoId)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid video ID format'
        });
      }

      // Validate key format
      if (!key.startsWith('videos/')) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid key format'
        });
      }

      // Here you would typically:
      // 1. Create a database record for the video
      // 2. Initialize processing status
      // 3. Return the created record

      return res.json({
        status: 'success',
        data: {
          videoId,
          key,
          status: 'processing',
          createdAt: new Date().toISOString(),
          userId: req.user?.id // Assuming req.user exists from auth middleware
        }
      });
    } catch (error) {
      console.error('Create video record error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to create video record',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  static async finalizeUpload(req: Request, res: Response) {
    try {
      const { videoId, key, metadata } = req.body as {
        videoId: string;
        key: string;
        metadata: VideoMetadata;
      };

      // Validate required fields
      if (!videoId || !key) {
        return res.status(400).json({
          status: 'error',
          message: 'VideoId and key are required'
        });
      }

      // Validate metadata
      if (!metadata || typeof metadata !== 'object') {
        return res.status(400).json({
          status: 'error',
          message: 'Valid metadata object is required'
        });
      }

      // Validate video ID and key format
      if (!this.isValidUUID(videoId) || !key.startsWith('videos/')) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid videoId or key format'
        });
      }

      // Here you would typically:
      // 1. Verify the upload was successful in S3
      // 2. Update the video record in your database
      // 3. Trigger any post-upload processing
      // 4. Return the updated record

      return res.json({
        status: 'success',
        data: {
          videoId,
          key,
          metadata,
          status: 'processing',
          updatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Finalize upload error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to finalize upload',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  private static isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}