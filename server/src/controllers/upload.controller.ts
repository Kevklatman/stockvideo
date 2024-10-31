// src/controllers/upload.controller.ts
import { Request, Response } from 'express';
import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import crypto from 'crypto';

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME!;

export class UploadController {
  static async getUploadUrl(req: Request, res: Response) {
    try {
      const { contentType } = req.body;

      if (!contentType) {
        return res.status(400).json({ error: 'Content type is required' });
      }

      const videoId = crypto.randomUUID();
      const key = `${videoId}${getFileExtension(contentType)}`;

      const { url, fields } = await createPresignedPost(s3Client, {
        Bucket: BUCKET_NAME,
        Key: key,
        Conditions: [
          ['content-length-range', 0, 100 * 1024 * 1024], // 100MB max
          ['starts-with', '$Content-Type', contentType],
        ],
        Expires: 3600, // 1 hour
      });

      res.json({
        url,
        fields,
        videoId,
        key
      });

    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  }
}

function getFileExtension(contentType: string): string {
  const extensions: { [key: string]: string } = {
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'video/x-msvideo': '.avi'
  };
  return extensions[contentType] || '.mp4';
}