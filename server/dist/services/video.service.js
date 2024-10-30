"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoService = void 0;
// src/services/video.service.ts
const database_1 = require("../config/database");
const video_model_1 = require("../models/video.model");
const video_processor_service_1 = require("./video-processor.service");
const types_1 = require("../types");
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const uuid_1 = require("uuid");
const redis_1 = __importDefault(require("../config/redis"));
const logger_1 = require("../utils/logger");
class VideoService {
    /**
     * Initialize required directories
     */
    static async initialize() {
        try {
            await fs.mkdir(this.uploadDir, { recursive: true });
            await fs.mkdir(this.tempDir, { recursive: true });
        }
        catch (error) {
            this.logger.error('Failed to initialize video service directories:', error);
            throw new types_1.VideoProcessingError('Service initialization failed');
        }
    }
    /**
     * Save and process uploaded video file
     */
    static async saveVideoFile(file, userId) {
        try {
            const videoId = (0, uuid_1.v4)();
            const userDir = path.join(this.uploadDir, userId);
            await fs.mkdir(userDir, { recursive: true });
            // Set processing status in Redis
            await redis_1.default.setex(`processing:${videoId}`, 1800, // 30 minutes TTL
            'true');
            // Process the video
            const processedVideo = await video_processor_service_1.VideoProcessorService.processFullVideo(file.path, path.join(userDir, videoId));
            // Upload to storage
            const uploadResults = await video_processor_service_1.VideoProcessorService.uploadToS3(processedVideo, videoId);
            // Clear processing status
            await redis_1.default.del(`processing:${videoId}`);
            // Clean up temporary files
            await this.cleanupTempFiles(file.path, processedVideo);
            return uploadResults;
        }
        catch (error) {
            // Clean up any temporary files on error
            if (file.path && await this.fileExists(file.path)) {
                await fs.unlink(file.path).catch(console.error);
            }
            if (error instanceof Error) {
                throw new types_1.VideoProcessingError(`Failed to process video: ${error.message}`);
            }
            throw new types_1.VideoProcessingError('Failed to process video');
        }
    }
    /**
     * Create a new video entry
     */
    static async createVideo(userId, videoData) {
        try {
            // Validate the input data
            const validationErrors = await this.validateCreateVideo(videoData);
            if (validationErrors.length > 0) {
                throw new types_1.ValidationError(`Invalid video data: ${validationErrors.join(', ')}`);
            }
            // Create a new video instance
            const video = this.videoRepository.create({
                ...videoData,
                user: { id: userId }
            });
            // Save the video to the database
            const savedVideo = await this.videoRepository.save(video);
            // Cache the video data
            await this.cacheVideoData(savedVideo);
            return savedVideo;
        }
        catch (error) {
            if (error instanceof types_1.ValidationError) {
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
    static async validateCreateVideo(videoData) {
        const errors = [];
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
    static async getVideo(videoId, includePrivate = false) {
        try {
            // Check cache first
            const cachedVideo = await this.getCachedVideo(videoId);
            if (cachedVideo) {
                if (includePrivate) {
                    return cachedVideo;
                }
            }
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
                await this.cacheVideoData(video);
            }
            return video;
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to fetch video: ${error.message}`);
            }
            throw new Error('Failed to fetch video');
        }
    }
    // Removed duplicate getUserVideos method
    /**
     * Update video details
     */
    static async updateVideo(videoId, userId, updates) {
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
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to update video: ${error.message}`);
            }
            throw new Error('Failed to update video');
        }
    }
    /**
     * Delete a video
     */
    static async deleteVideo(videoId, userId) {
        try {
            const video = await this.videoRepository.findOne({
                where: { id: videoId, user: { id: userId } }
            });
            if (!video) {
                return false;
            }
            // Delete from storage first
            await video_processor_service_1.VideoProcessorService.deleteFromS3(videoId);
            // Delete from database
            await this.videoRepository.remove(video);
            // Clear cache
            await this.clearVideoCache(videoId);
            return true;
        }
        catch (error) {
            if (error instanceof types_1.StorageError) {
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
    static async searchVideos(query, options = {}) {
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
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to search videos: ${error.message}`);
            }
            throw new Error('Failed to search videos');
        }
    }
    /**
     * Private helper methods
     */
    static async cleanupTempFiles(originalFile, processedVideo) {
        const filesToDelete = [
            originalFile,
            processedVideo.preview,
            processedVideo.thumbnail,
            ...Object.values(processedVideo.qualities)
        ];
        await Promise.all(filesToDelete.map(file => fs.unlink(file).catch(err => this.logger.error(`Failed to delete file ${file}:`, err))));
    }
    static async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    static sanitizeUpdates(updates) {
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
            obj[key] = updates[key];
            return obj;
        }, {});
    }
    static async cacheVideoData(video) {
        const cacheKey = `video:${video.id}`;
        await redis_1.default.setex(cacheKey, this.CACHE_TTL, JSON.stringify(video));
    }
    static async getCachedVideo(videoId) {
        const cacheKey = `video:${videoId}`;
        const cachedData = await redis_1.default.get(cacheKey);
        if (cachedData) {
            return JSON.parse(cachedData);
        }
        return null;
    }
    static async clearVideoCache(videoId) {
        const cacheKey = `video:${videoId}`;
        await redis_1.default.del(cacheKey);
    }
    // Removed duplicate deleteVideo method
    /**
     * Get videos for a specific user
     */
    static async getUserVideos(userId, options = {}) {
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
            }
            else if (options.filter === 'processing') {
                queryBuilder.andWhere('video.status = :status', { status: 'processing' });
            }
            const [videos, total] = await queryBuilder.getManyAndCount();
            const pages = Math.ceil(total / limit);
            return { videos, total, pages };
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to fetch user videos: ${error.message}`);
            }
            throw new Error('Failed to fetch user videos');
        }
    }
}
exports.VideoService = VideoService;
VideoService.videoRepository = database_1.AppDataSource.getRepository(video_model_1.Video);
VideoService.uploadDir = path.join(__dirname, '../../uploads');
VideoService.tempDir = path.join(__dirname, '../../uploads/temp');
VideoService.CACHE_TTL = 3600; // 1 hour
VideoService.logger = logger_1.Logger.getInstance();
