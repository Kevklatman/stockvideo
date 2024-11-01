import { 
  S3Client, 
  GetObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl as getCloudFrontSignedUrl } from '@aws-sdk/cloudfront-signer';
import dotenv from 'dotenv';
import { Request, Response } from 'express';

dotenv.config();

export class S3Service {
  private s3Client: S3Client;
  private bucket: string;
  private cloudFrontDomain: string;
  private cloudFrontKeyPairId: string;
  private cloudFrontPrivateKey: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
      }
    });

    this.bucket = process.env.AWS_BUCKET_NAME!;
    this.cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN!;
    this.cloudFrontKeyPairId = process.env.CLOUDFRONT_KEY_PAIR_ID!;
    this.cloudFrontPrivateKey = process.env.CLOUDFRONT_PRIVATE_KEY!;
  }

  async getVideoStreamingUrl(videoId: string) {
    const streamPath = `/videos/${videoId}/processed/stream.m3u8`;
    const url = `https://${this.cloudFrontDomain}${streamPath}`;
    
    return getCloudFrontSignedUrl({
      url,
      keyPairId: this.cloudFrontKeyPairId,
      privateKey: this.cloudFrontPrivateKey,
      dateLessThan: new Date(Date.now() + 3600 * 1000).toISOString() // 1 hour
    });
  }

  async getThumbnailUrl(videoId: string) {
    const thumbnailPath = `/videos/${videoId}/thumbnail.jpg`;
    const url = `https://${this.cloudFrontDomain}${thumbnailPath}`;
    
    return getCloudFrontSignedUrl({
      url,
      keyPairId: this.cloudFrontKeyPairId,
      privateKey: this.cloudFrontPrivateKey,
      dateLessThan: new Date(Date.now() + 3600 * 1000).toISOString()
    });
  }

  async createPresignedPost(key: string, contentType: string, options: { maxSize: number }) {
    return createPresignedPost(this.s3Client, {
      Bucket: this.bucket,
      Key: key,
      Conditions: [
        ['content-length-range', 0, options.maxSize],
        ['eq', '$Content-Type', contentType],
      ],
      Fields: {
        'Content-Type': contentType,
      },
      Expires: 3600,
    });
  }
}

export const s3Service = new S3Service();

// Express route handler
export async function handleUploadRequest(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'Invalid token'
    });
  }

  try {
    const { key, contentType, fileSize } = req.body;

    if (!key || !contentType || !fileSize) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_FIELDS',
        message: 'Missing required fields: key, contentType, or fileSize',
      });
    }

    const MAX_FILE_SIZE = 100 * 1024 * 1024;
    if (fileSize > MAX_FILE_SIZE) {
      return res.status(400).json({
        status: 'error',
        code: 'FILE_TOO_LARGE',
        message: 'File size exceeds maximum limit of 100MB',
      });
    }

    const presignedPost = await s3Service.createPresignedPost(key, contentType, {
      maxSize: MAX_FILE_SIZE,
    });

    const videoId = key.split('/').pop()?.split('.')[0];
    const streamingUrl = videoId ? await s3Service.getVideoStreamingUrl(videoId) : null;

    return res.json({
      status: 'success',
      data: {
        ...presignedPost,
        streamingUrl,
      }
    });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    return res.status(500).json({
      status: 'error',
      code: 'UPLOAD_URL_GENERATION_FAILED',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}