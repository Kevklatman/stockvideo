// src/services/video.service.ts
import { AppDataSource } from "../config/database";
import { Video } from "../models/video.model";
import { User } from "../models/user.model";
import { VideoProcessorService } from "./video-processor.service";
import { 
  VideoUploadResult, 
  VideoProcessingError, 
  StorageError,
  ValidationError,
  ProcessedVideo
} from "../types";
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import redisClient from '../config/redis';
import { FindOptionsWhere, In } from "typeorm";
import { CreateVideoDto, UpdateVideoDto } from "../dtos/video.dto";
import { Logger } from "../utils/logger";


export class VideoService {
  private static videoRepository = AppDataSource.getRepository(Video);
  private static uploadDir = path.join(__dirname, '../../uploads');
  private static tempDir = path.join(__dirname, '../../uploads/temp');
  private static readonly CACHE_TTL = 3600; // 1 hour
  private static readonly logger = Logger.getInstance();

  /**
   * Initialize required directories
   */
  static async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to initialize video service directories:', error);
      throw new VideoProcessingError('Service initialization failed');
    }
  }

  /**
   * Save and process uploaded video file
   */
  static async saveVideoFile(
    file: Express.Multer.File,
    userId: string
  ): Promise<VideoUploadResult> {
    try {
      const videoId = uuidv4();
      const userDir = path.join(this.uploadDir, userId);
      await fs.mkdir(userDir, { recursive: true });

      // Set processing status in Redis
      await redisClient.setex(
        `processing:${videoId}`,
        1800, // 30 minutes TTL
        'true'
      );

      // Process the video
      const processedVideo = await VideoProcessorService.processFullVideo(
        file.path,
        path.join(userDir, videoId)
      );

      // Upload to storage
      const uploadResults = await VideoProcessorService.uploadToS3(
        processedVideo,
        videoId
      );

      // Clear processing status
      await redisClient.del(`processing:${videoId}`);

      // Clean up temporary files
      await this.cleanupTempFiles(file.path, processedVideo);

      return uploadResults;
    } catch (error) {
      // Clean up any temporary files on error
      if (file.path && await this.fileExists(file.path)) {
        await fs.unlink(file.path).catch(console.error);
      }

      if (error instanceof Error) {
        throw new VideoProcessingError(
          `Failed to process video: ${error.message}`
        );
      }
      throw new VideoProcessingError('Failed to process video');
    }
  }

/**
 * Create a new video entry
 */
static async createVideo(
  userId: string,
  videoData: CreateVideoDto
): Promise<Video> {
  try {
    // Validate the input data
    const validationErrors = await this.validateCreateVideo(videoData);
    if (validationErrors.length > 0) {
      throw new ValidationError(`Invalid video data: ${validationErrors.join(', ')}`);
    }

    // Create a new video instance
    const video = this.videoRepository.create({
      ...videoData,
      user: { id: userId } as User
    });

    // Save the video to the database
    const savedVideo = await this.videoRepository.save(video);
    
    // Cache the video data
    await this.cacheVideoData(savedVideo);
    
    return savedVideo;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new Error(`Failed to create video: ${error.message}`);
    }
    throw new Error('Failed to create video');
  }
}
/**
 * Validate create video input data
 */
private static async validateCreateVideo(videoData: CreateVideoDto): Promise<string[]> {
  const errors: string[] = [];

  if (!videoData.title || videoData.title.trim().length === 0) {
    errors.push('Title is required');
  }

  if (!videoData.description || videoData.description.trim().length === 0) {
    errors.push('Description is required');
  }

  if (videoData.price && isNaN(videoData.price)) {
    errors.push('Price must be a number');
  }

  if (videoData.tags && !Array.isArray(videoData.tags)) {
    errors.push('Tags must be an array');
  }

  return errors;
}

  /**
   * Get a single video by ID
   */
// In VideoService
static async getVideo(videoId: string, includePrivate = false): Promise<Video | null> {
  try {
    // Check cache first
    const cachedVideo = await this.getCachedVideo(videoId);
    if (cachedVideo) {
      return cachedVideo;
    }

    // Log the search attempt
    console.log('Searching for video:', videoId);

    const video = await this.videoRepository.findOne({
      where: { id: videoId },
      relations: ['user'],
      select: includePrivate ? undefined : {
        id: true,
        title: true,
        description: true,
        price: true,
        previewUrl: true,
        fullVideoUrl: true,
        createdAt: true,
        user: {
          id: true,
          email: true
        }
      }
    });

    if (video) {
      // Cache the video data
      await this.cacheVideoData(video);
      console.log('Found video:', video.id);
    } else {
      console.log('No video found with ID:', videoId);
    }

    return video;
  } catch (error) {
    console.error('Error fetching video:', error);
    throw error;
  }
}

  // Removed duplicate getUserVideos method

  /**
   * Update video details
   */
  static async updateVideo(
    videoId: string,
    userId: string,
    updates: UpdateVideoDto
  ): Promise<Video | null> {
    try {
      const video = await this.videoRepository.findOne({
        where: { id: videoId, user: { id: userId } }
      });

      if (!video) {
        return null;
      }

      // Remove any protected fields from updates
      const safeUpdates = this.sanitizeUpdates(updates);

      Object.assign(video, safeUpdates);
      const updatedVideo = await this.videoRepository.save(video);

      // Update cache
      await this.cacheVideoData(updatedVideo);

      return updatedVideo;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to update video: ${error.message}`);
      }
      throw new Error('Failed to update video');
    }
  }

  /**
   * Delete a video
   */
  static async deleteVideo(videoId: string, userId: string): Promise<boolean> {
    try {
      const video = await this.videoRepository.findOne({
        where: { id: videoId, user: { id: userId } }
      });

      if (!video) {
        return false;
      }

      // Delete from storage first
      await VideoProcessorService.deleteFromS3(videoId);

      // Delete from database
      await this.videoRepository.remove(video);

      // Clear cache
      await this.clearVideoCache(videoId);

      return true;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new Error(`Failed to delete video: ${error.message}`);
      }
      throw new Error('Failed to delete video');
    }
  }

  /**
   * Search videos
   */
  static async searchVideos(
    query: string,
    options: {
      page?: number;
      limit?: number;
      sort?: string;
      minPrice?: number;
      maxPrice?: number;
      tags?: string[];
    } = {}
  ): Promise<{ videos: Video[]; total: number; pages: number }> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 10;
      const skip = (page - 1) * limit;

      const queryBuilder = this.videoRepository.createQueryBuilder('video')
        .leftJoinAndSelect('video.user', 'user')
        .where('video.title ILIKE :query OR video.description ILIKE :query', {
          query: `%${query}%`
        })
        .skip(skip)
        .take(limit);

      if (options.minPrice !== undefined) {
        queryBuilder.andWhere('video.price >= :minPrice', { 
          minPrice: options.minPrice 
        });
      }

      if (options.maxPrice !== undefined) {
        queryBuilder.andWhere('video.price <= :maxPrice', { 
          maxPrice: options.maxPrice 
        });
      }

      if (options.tags && options.tags.length > 0) {
        queryBuilder.andWhere('video.tags && :tags', { 
          tags: options.tags 
        });
      }

      const [videos, total] = await queryBuilder.getManyAndCount();
      const pages = Math.ceil(total / limit);

      return { videos, total, pages };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to search videos: ${error.message}`);
      }
      throw new Error('Failed to search videos');
    }
  }

  /**
   * Private helper methods
   */
  private static async cleanupTempFiles(
    originalFile: string,
    processedVideo: ProcessedVideo
  ): Promise<void> {
    const filesToDelete = [
      originalFile,
      processedVideo.preview,
      processedVideo.thumbnail,
      ...Object.values(processedVideo.qualities)
    ];

    await Promise.all(
      filesToDelete.map(file => 
        fs.unlink(file).catch(err => 
          this.logger.error(`Failed to delete file ${file}:`, err)
        )
      )
    );
  }

  private static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private static sanitizeUpdates(updates: Partial<Video>): Partial<Video> {
    const protectedFields = [
      'id',
      'userId',
      'createdAt',
      'updatedAt',
      'fullVideoUrl',
      'previewUrl'
    ];

    return Object.keys(updates)
      .filter(key => !protectedFields.includes(key))
      .reduce((obj, key) => {
        (obj as any)[key] = updates[key as keyof Video];
        return obj;
      }, {} as Partial<Video>);
  }

  private static async cacheVideoData(video: Video): Promise<void> {
    const cacheKey = `video:${video.id}`;
    await redisClient.setex(
      cacheKey,
      this.CACHE_TTL,
      JSON.stringify(video)
    );
  }

  private static async getCachedVideo(videoId: string): Promise<Video | null> {
    const cacheKey = `video:${videoId}`;
    const cachedData = await redisClient.get(cacheKey);
    
    if (cachedData) {
      return JSON.parse(cachedData);
    }
    
    return null;
  }

  private static async clearVideoCache(videoId: string): Promise<void> {
    const cacheKey = `video:${videoId}`;
    await redisClient.del(cacheKey);
  }
  


// Removed duplicate deleteVideo method

/**
 * Get videos for a specific user
 */
static async getUserVideos(
  userId: string,
  options: {
    page?: number;
    limit?: number;
    sort?: 'newest' | 'oldest' | 'popular';
    filter?: 'all' | 'published' | 'processing';
  } = {}
): Promise<{ videos: Video[]; total: number; pages: number }> {
  try {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = this.videoRepository.createQueryBuilder('video')
      .where('video.user.id = :userId', { userId })
      .leftJoinAndSelect('video.user', 'user')
      .skip(skip)
      .take(limit);

    // Apply sorting
    switch (options.sort) {
      case 'oldest':
        queryBuilder.orderBy('video.createdAt', 'ASC');
        break;
      case 'popular':
        queryBuilder.orderBy('video.viewCount', 'DESC');
        break;
      default:
        queryBuilder.orderBy('video.createdAt', 'DESC');
    }

    // Apply filters
    if (options.filter === 'published') {
      queryBuilder.andWhere('video.status = :status', { status: 'published' });
    } else if (options.filter === 'processing') {
      queryBuilder.andWhere('video.status = :status', { status: 'processing' });
    }

    const [videos, total] = await queryBuilder.getManyAndCount();
    const pages = Math.ceil(total / limit);

    return { videos, total, pages };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch user videos: ${error.message}`);
    }
    throw new Error('Failed to fetch user videos');
  }
}

// Removed duplicate searchVideos method
}

