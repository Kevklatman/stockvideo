// src/services/video-access.service.ts
import jwt from 'jsonwebtoken';
import { AppDataSource } from "../config/database";
import { Video } from "../models/video.model";
import { PaymentService } from "./payment.service";
import { S3 } from 'aws-sdk';
import { randomBytes } from 'crypto';
import redisClient from '../config/redis';
import { 
  StreamingToken, 
  VideoAccessError,
  DownloadToken
} from '../types';
import https from 'https';
import { Readable } from 'stream';

interface PartialContentResponse {
  headers: {
    'Content-Range': string;
    'Accept-Ranges': string;
    'Content-Length': number;
    'Content-Type': string;
  };
  stream: Readable;
}

export class VideoAccessService {
  private static videoRepository = AppDataSource.getRepository(Video);
  
  private static s3 = new S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
  });

  private static redis = redisClient;

    /**
   * Handles partial content requests for video streaming
   */
    static async handlePartialContent(
      streamUrl: string,
      rangeHeader: string
    ): Promise<PartialContentResponse> {
      try {
        // Parse the range header
        const range = this.parseRangeHeader(rangeHeader);
        if (!range) {
          throw new VideoAccessError('Invalid range header');
        }
  
        // Get the video size
        const videoSize = await this.getVideoSize(streamUrl);
  
        // Calculate the chunk size
        const start = range.start;
        const end = range.end || Math.min(start + 1000000, videoSize - 1); // 1MB chunks
        const contentLength = end - start + 1;
  
        // Create read stream with range
        const stream = await this.createRangeStream(streamUrl, start, end);
  
        return {
          headers: {
            'Content-Range': `bytes ${start}-${end}/${videoSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': contentLength,
            'Content-Type': 'video/mp4'
          },
          stream
        };
      } catch (error) {
        throw new VideoAccessError(
          `Failed to handle partial content: ${(error as Error).message}`
        );
      }
    }
  
    /**
     * Parse range header
     */
    private static parseRangeHeader(rangeHeader: string): { start: number; end?: number } | null {
      const matches = rangeHeader.match(/bytes=(\d+)-(\d+)?/);
      if (!matches) {
        return null;
      }
  
      return {
        start: parseInt(matches[1], 10),
        end: matches[2] ? parseInt(matches[2], 10) : undefined
      };
    }
  
    /**
     * Get video file size
     */
    private static async getVideoSize(url: string): Promise<number> {
      return new Promise((resolve, reject) => {
        https.get(url, (response) => {
          const contentLength = response.headers['content-length'];
          if (contentLength) {
            resolve(parseInt(contentLength, 10));
          } else {
            reject(new Error('Content-Length header not found'));
          }
          response.destroy(); // Clean up the connection
        }).on('error', reject);
      });
    }
  
    /**
     * Create a readable stream for the specified range
     */
    private static async createRangeStream(
      url: string,
      start: number,
      end: number
    ): Promise<Readable> {
      const response = await new Promise<Readable>((resolve, reject) => {
        const options = {
          headers: {
            Range: `bytes=${start}-${end}`
          }
        };
  
        https.get(url, options, (response) => {
          if (response.statusCode === 206) {
            resolve(response);
          } else {
            response.destroy();
            reject(new Error('Failed to create range stream'));
          }
        }).on('error', reject);
      });
  
      return response;
    }

  /**
   * Generates a signed URL for accessing preview content
   */
  static async getPreviewUrl(videoId: string): Promise<string> {
    try {
      const video = await this.videoRepository.findOne({
        where: { id: videoId }
      });

      if (!video) {
        throw new VideoAccessError('Video not found');
      }

      // Check cache first
      const cachedUrl = await this.redis.get(`preview:${videoId}`);
      if (cachedUrl) {
        return cachedUrl;
      }

      // Generate new signed URL
      const previewUrl = this.s3.getSignedUrl('getObject', {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: `previews/${video.previewUrl}`,
        Expires: 300 // 5 minutes
      });

      // Cache the URL
      await this.redis.setex(`preview:${videoId}`, 240, previewUrl); // Cache for 4 minutes

      return previewUrl;
    } catch (error) {
      if (error instanceof VideoAccessError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new VideoAccessError(`Failed to generate preview URL: ${error.message}`);
      }
      throw new VideoAccessError('Failed to generate preview URL due to an unknown error');
    }
  }

  /**
   * Generates a streaming token for full video access
   */
  static async getStreamingToken(videoId: string, userId: string): Promise<string | null> {
    try {
      // Check rate limit
      const isWithinLimit = await this.checkRateLimit(userId);
      if (!isWithinLimit) {
        throw new VideoAccessError('Rate limit exceeded');
      }

      // Verify purchase
      const hasPurchased = await PaymentService.verifyPurchase(userId, videoId);
      if (!hasPurchased) {
        return null;
      }

      const video = await this.videoRepository.findOne({
        where: { id: videoId }
      });

      if (!video) {
        throw new VideoAccessError('Video not found');
      }

      // Generate streaming token
      const token = jwt.sign(
        {
          videoId,
          userId,
          type: 'stream',
          exp: Math.floor(Date.now() / 1000) + (3600 * 4) // 4 hours
        } as StreamingToken,
        process.env.JWT_STREAMING_SECRET || 'streaming-secret'
      );

      // Store token in Redis for quick validation
      await this.redis.setex(
        `streamtoken:${token}`,
        14400, // 4 hours
        JSON.stringify({ videoId, userId })
      );

      return token;
    } catch (error) {
      if (error instanceof VideoAccessError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new VideoAccessError(`Failed to generate streaming token: ${error.message}`);
      }
      throw new VideoAccessError('Failed to generate streaming token due to an unknown error');
    }
  }

  /**
   * Generates a one-time download token
   */
  static async getDownloadToken(videoId: string, userId: string): Promise<string | null> {
    try {
      // Verify purchase
      const hasPurchased = await PaymentService.verifyPurchase(userId, videoId);
      if (!hasPurchased) {
        return null;
      }

      const video = await this.videoRepository.findOne({
        where: { id: videoId }
      });

      if (!video) {
        throw new VideoAccessError('Video not found');
      }

      // Generate download token
      const downloadId = randomBytes(32).toString('hex');
      const downloadToken: DownloadToken = {
        videoId,
        userId,
        expiresAt: Date.now() + 3600000 // 1 hour
      };

      // Store token in Redis
      await this.storeDownloadToken(downloadId, downloadToken);

      return downloadId;
    } catch (error) {
      if (error instanceof VideoAccessError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new VideoAccessError(`Failed to generate download token: ${error.message}`);
      }
      throw new VideoAccessError('Failed to generate download token due to an unknown error');
    }
  }

  /**
   * Validates a streaming token and returns video access URL
   */
  static async validateStreamingToken(token: string): Promise<string | null> {
    try {
      // Check Redis first for quick validation
      const cachedToken = await this.redis.get(`streamtoken:${token}`);
      if (!cachedToken) {
        return null;
      }

      // Verify JWT
      const decoded = jwt.verify(
        token,
        process.env.JWT_STREAMING_SECRET || 'streaming-secret'
      ) as StreamingToken;

      if (decoded.type !== 'stream') {
        return null;
      }

      const video = await this.videoRepository.findOne({
        where: { id: decoded.videoId }
      });

      if (!video) {
        return null;
      }

      // Generate short-lived URL
      const videoUrl = this.s3.getSignedUrl('getObject', {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: `videos/${video.fullVideoUrl}`,
        Expires: 60 // 1 minute
      });

      return videoUrl;
    } catch (error) {
      return null;
    }
  }
/**
 * Checks if a user is the owner of a video
 */
static async isVideoOwner(videoId: string, userId: string): Promise<boolean> {
  try {
    const video = await this.videoRepository.findOne({
      where: { id: videoId }
    });

    if (!video) {
      throw new VideoAccessError('Video not found');
    }

    // Check cache first
    const cacheKey = `video:owner:${videoId}:${userId}`;
    const cachedResult = await this.redis.get(cacheKey);
    
    if (cachedResult !== null) {
      return cachedResult === 'true';
    }

    const isOwner = video.userId === userId;

    // Cache the result for 1 hour
    await this.redis.setex(cacheKey, 3600, isOwner.toString());

    return isOwner;
  } catch (error) {
    if (error instanceof VideoAccessError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new VideoAccessError(`Failed to check video ownership: ${error.message}`);
    }
    throw new VideoAccessError('Failed to check video ownership due to an unknown error');
  }
}
  /**
   * Processes a download token and returns download URL
   */
  static async processDownload(downloadId: string): Promise<{ url: string; filename: string } | null> {
    try {
      const downloadToken = await this.getAndDeleteDownloadToken(downloadId);
      if (!downloadToken) {
        return null;
      }

      const video = await this.videoRepository.findOne({
        where: { id: downloadToken.videoId }
      });

      if (!video) {
        return null;
      }

      const url = this.s3.getSignedUrl('getObject', {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: `videos/${video.fullVideoUrl}`,
        Expires: 300, // 5 minutes
        ResponseContentDisposition: `attachment; filename="${video.title}.mp4"`
      });

      return {
        url,
        filename: `${video.title}.mp4`
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Checks rate limit for video access
   */
  private static async checkRateLimit(userId: string): Promise<boolean> {
    const key = `ratelimit:video:${userId}`;
    const limit = 100; // requests
    const window = 3600; // 1 hour in seconds

    const multi = this.redis.multi();
    multi.incr(key);
    multi.expire(key, window);

    const [current] = await multi.exec() || [[null, 0]];
    return (current?.[1] as number) <= limit;
  }

  /**
   * Stores a download token in Redis
   */
  private static async storeDownloadToken(
    downloadId: string,
    token: DownloadToken
  ): Promise<void> {
    await this.redis.setex(
      `download:${downloadId}`,
      3600, // 1 hour
      JSON.stringify(token)
    );
  }

  /**
   * Retrieves and deletes a download token from Redis
   */
  private static async getAndDeleteDownloadToken(
    downloadId: string
  ): Promise<DownloadToken | null> {
    const downloadKey = `download:${downloadId}`;
    
    const multi = this.redis.multi();
    multi.get(downloadKey);
    multi.del(downloadKey);
    
    const [downloadInfoStr] = await multi.exec() || [];

    if (!downloadInfoStr?.[1]) {
      return null;
    }

    try {
      const token = JSON.parse(downloadInfoStr[1] as string) as DownloadToken;
      if (token.expiresAt < Date.now()) {
        return null;
      }
      return token;
    } catch {
      return null;
    }
  }

  /**
   * Invalidates a streaming token
   */
  static async invalidateStreamingToken(token: string): Promise<void> {
    await this.redis.del(`streamtoken:${token}`);
  }

  /**
   * Cleans up expired tokens
   * This should be run periodically via a cron job
   */
  static async cleanupExpiredTokens(): Promise<void> {
    const pattern = 'streamtoken:*';
    const stream = this.redis.scanStream({
      match: pattern,
      count: 100
    });

    for await (const keys of stream) {
      for (const key of keys) {
        const token = key.replace('streamtoken:', '');
        try {
          jwt.verify(token, process.env.JWT_STREAMING_SECRET || 'streaming-secret');
        } catch (error) {
          await this.redis.del(key);
        }
      }
    }
  }
}