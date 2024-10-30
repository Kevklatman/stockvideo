"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoAccessService = void 0;
// src/services/video-access.service.ts
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../config/database");
const video_model_1 = require("../models/video.model");
const payment_service_1 = require("./payment.service");
const aws_sdk_1 = require("aws-sdk");
const crypto_1 = require("crypto");
const redis_1 = __importDefault(require("../config/redis"));
const types_1 = require("../types");
const https_1 = __importDefault(require("https"));
class VideoAccessService {
    /**
   * Handles partial content requests for video streaming
   */
    static async handlePartialContent(streamUrl, rangeHeader) {
        try {
            // Parse the range header
            const range = this.parseRangeHeader(rangeHeader);
            if (!range) {
                throw new types_1.VideoAccessError('Invalid range header');
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
        }
        catch (error) {
            throw new types_1.VideoAccessError(`Failed to handle partial content: ${error.message}`);
        }
    }
    /**
     * Parse range header
     */
    static parseRangeHeader(rangeHeader) {
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
    static async getVideoSize(url) {
        return new Promise((resolve, reject) => {
            https_1.default.get(url, (response) => {
                const contentLength = response.headers['content-length'];
                if (contentLength) {
                    resolve(parseInt(contentLength, 10));
                }
                else {
                    reject(new Error('Content-Length header not found'));
                }
                response.destroy(); // Clean up the connection
            }).on('error', reject);
        });
    }
    /**
     * Create a readable stream for the specified range
     */
    static async createRangeStream(url, start, end) {
        const response = await new Promise((resolve, reject) => {
            const options = {
                headers: {
                    Range: `bytes=${start}-${end}`
                }
            };
            https_1.default.get(url, options, (response) => {
                if (response.statusCode === 206) {
                    resolve(response);
                }
                else {
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
    static async getPreviewUrl(videoId) {
        try {
            const video = await this.videoRepository.findOne({
                where: { id: videoId }
            });
            if (!video) {
                throw new types_1.VideoAccessError('Video not found');
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
        }
        catch (error) {
            if (error instanceof types_1.VideoAccessError) {
                throw error;
            }
            if (error instanceof Error) {
                throw new types_1.VideoAccessError(`Failed to generate preview URL: ${error.message}`);
            }
            throw new types_1.VideoAccessError('Failed to generate preview URL due to an unknown error');
        }
    }
    /**
     * Generates a streaming token for full video access
     */
    static async getStreamingToken(videoId, userId) {
        try {
            // Check rate limit
            const isWithinLimit = await this.checkRateLimit(userId);
            if (!isWithinLimit) {
                throw new types_1.VideoAccessError('Rate limit exceeded');
            }
            // Verify purchase
            const hasPurchased = await payment_service_1.PaymentService.verifyPurchase(userId, videoId);
            if (!hasPurchased) {
                return null;
            }
            const video = await this.videoRepository.findOne({
                where: { id: videoId }
            });
            if (!video) {
                throw new types_1.VideoAccessError('Video not found');
            }
            // Generate streaming token
            const token = jsonwebtoken_1.default.sign({
                videoId,
                userId,
                type: 'stream',
                exp: Math.floor(Date.now() / 1000) + (3600 * 4) // 4 hours
            }, process.env.JWT_STREAMING_SECRET || 'streaming-secret');
            // Store token in Redis for quick validation
            await this.redis.setex(`streamtoken:${token}`, 14400, // 4 hours
            JSON.stringify({ videoId, userId }));
            return token;
        }
        catch (error) {
            if (error instanceof types_1.VideoAccessError) {
                throw error;
            }
            if (error instanceof Error) {
                throw new types_1.VideoAccessError(`Failed to generate streaming token: ${error.message}`);
            }
            throw new types_1.VideoAccessError('Failed to generate streaming token due to an unknown error');
        }
    }
    /**
     * Generates a one-time download token
     */
    static async getDownloadToken(videoId, userId) {
        try {
            // Verify purchase
            const hasPurchased = await payment_service_1.PaymentService.verifyPurchase(userId, videoId);
            if (!hasPurchased) {
                return null;
            }
            const video = await this.videoRepository.findOne({
                where: { id: videoId }
            });
            if (!video) {
                throw new types_1.VideoAccessError('Video not found');
            }
            // Generate download token
            const downloadId = (0, crypto_1.randomBytes)(32).toString('hex');
            const downloadToken = {
                videoId,
                userId,
                expiresAt: Date.now() + 3600000 // 1 hour
            };
            // Store token in Redis
            await this.storeDownloadToken(downloadId, downloadToken);
            return downloadId;
        }
        catch (error) {
            if (error instanceof types_1.VideoAccessError) {
                throw error;
            }
            if (error instanceof Error) {
                throw new types_1.VideoAccessError(`Failed to generate download token: ${error.message}`);
            }
            throw new types_1.VideoAccessError('Failed to generate download token due to an unknown error');
        }
    }
    /**
     * Validates a streaming token and returns video access URL
     */
    static async validateStreamingToken(token) {
        try {
            // Check Redis first for quick validation
            const cachedToken = await this.redis.get(`streamtoken:${token}`);
            if (!cachedToken) {
                return null;
            }
            // Verify JWT
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_STREAMING_SECRET || 'streaming-secret');
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
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Processes a download token and returns download URL
     */
    static async processDownload(downloadId) {
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
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Checks rate limit for video access
     */
    static async checkRateLimit(userId) {
        const key = `ratelimit:video:${userId}`;
        const limit = 100; // requests
        const window = 3600; // 1 hour in seconds
        const multi = this.redis.multi();
        multi.incr(key);
        multi.expire(key, window);
        const [current] = await multi.exec() || [[null, 0]];
        return current?.[1] <= limit;
    }
    /**
     * Stores a download token in Redis
     */
    static async storeDownloadToken(downloadId, token) {
        await this.redis.setex(`download:${downloadId}`, 3600, // 1 hour
        JSON.stringify(token));
    }
    /**
     * Retrieves and deletes a download token from Redis
     */
    static async getAndDeleteDownloadToken(downloadId) {
        const downloadKey = `download:${downloadId}`;
        const multi = this.redis.multi();
        multi.get(downloadKey);
        multi.del(downloadKey);
        const [downloadInfoStr] = await multi.exec() || [];
        if (!downloadInfoStr?.[1]) {
            return null;
        }
        try {
            const token = JSON.parse(downloadInfoStr[1]);
            if (token.expiresAt < Date.now()) {
                return null;
            }
            return token;
        }
        catch {
            return null;
        }
    }
    /**
     * Invalidates a streaming token
     */
    static async invalidateStreamingToken(token) {
        await this.redis.del(`streamtoken:${token}`);
    }
    /**
     * Cleans up expired tokens
     * This should be run periodically via a cron job
     */
    static async cleanupExpiredTokens() {
        const pattern = 'streamtoken:*';
        const stream = this.redis.scanStream({
            match: pattern,
            count: 100
        });
        for await (const keys of stream) {
            for (const key of keys) {
                const token = key.replace('streamtoken:', '');
                try {
                    jsonwebtoken_1.default.verify(token, process.env.JWT_STREAMING_SECRET || 'streaming-secret');
                }
                catch (error) {
                    await this.redis.del(key);
                }
            }
        }
    }
}
exports.VideoAccessService = VideoAccessService;
VideoAccessService.videoRepository = database_1.AppDataSource.getRepository(video_model_1.Video);
VideoAccessService.s3 = new aws_sdk_1.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});
VideoAccessService.redis = redis_1.default;
