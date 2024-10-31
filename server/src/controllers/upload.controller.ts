// src/controllers/upload.controller.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { Request, Response } from 'express';

// Add debugging
console.log('Loading upload controller with AWS config:', {
  region: process.env.AWS_REGION,
  bucket: process.env.AWS_BUCKET_NAME,
  hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
  hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export class UploadController {
  static async getUploadUrl(req: Request, res: Response) {
    try {
      const { contentType } = req.body;

      if (!contentType) {
        return res.status(400).json({ error: 'Content type is required' });
      }

      const videoId = crypto.randomUUID();
      const key = `videos/${videoId}${getFileExtension(contentType)}`;

      // Create the command
      const command = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        ContentType: contentType
      });

      console.log('Generating signed URL with params:', {
        bucket: BUCKET_NAME,
        key,
        contentType
      });

      // Generate signed URL
      const signedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 3600
      });

      return res.json({
        videoId,
        key,
        uploadUrl: signedUrl,
        contentType
      });

    } catch (error) {
      console.error('Upload URL generation error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        bucket: BUCKET_NAME,
        region: process.env.AWS_REGION
      });

      return res.status(500).json({
        error: 'Failed to generate upload URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
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