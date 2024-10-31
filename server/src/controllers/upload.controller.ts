// src/controllers/upload.controller.ts
import { Request, Response } from 'express';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});

const BUCKET_NAME = process.env.BUCKET_NAME!;
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export class UploadController {
  static async getUploadUrl(req: Request, res: Response) {
    try {
      const { contentType } = req.body;

      if (!contentType) {
        return res.status(400).json({
          status: 'error',
          message: 'Content type is required'
        });
      }

      const videoId = crypto.randomUUID();

      // Validate content type
      if (!ALLOWED_VIDEO_TYPES.includes(contentType)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid content type'
        });
      }

      if (!BUCKET_NAME) {
        throw new Error('Bucket name is not configured');
      }

      // Generate presigned URL
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `videos/${videoId}`,
        ContentType: contentType,
        // Add additional metadata
        // Add additional metadata
        Metadata: {
          uploadedAt: new Date().toISOString()
        }
      });

      const url = await getSignedUrl(s3Client, command, { 
        expiresIn: 3600 // URL expires in 1 hour
      });

      res.json({
        status: 'success',
        data: {
          url,
          videoId,
          key: `videos/${videoId}`
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

      if (!videoId || !key) {
        return res.status(400).json({
          status: 'error',
          message: 'VideoId and key are required'
        });
      }

      // Here you would typically save the video record to your database
      // This is just a placeholder response
      res.json({
        status: 'success',
        data: {
          videoId,
          key,
          status: 'processing'
        }
      });
    } catch (error) {
      console.error('Create video record error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to create video record'
      });
    }
  }
}