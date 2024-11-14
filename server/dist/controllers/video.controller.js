"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoController = void 0;
const database_1 = require("../config/database");
const video_model_1 = require("../models/video.model");
const purchase_model_1 = require("../models/purchase.model");
const video_service_1 = require("../services/video.service");
const video_access_service_1 = require("../services/video-access.service");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const video_dto_1 = require("../dtos/video.dto");
const errors_1 = require("../types/errors");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const crypto_1 = __importDefault(require("crypto"));
const payment_service_1 = require("../services/payment.service");
const types_1 = require("../types");
class VideoController {
    // src/controllers/upload.controller.ts
    // src/controllers/upload.controller.ts
    static async getUploadUrl(req, res) {
        try {
            const { contentType } = req.body;
            if (!contentType) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Content type is required'
                });
            }
            const videoId = crypto_1.default.randomUUID();
            const key = `videos/${videoId}`;
            // Generate the signed URL
            const command = new client_s3_1.PutObjectCommand({
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: key,
                ContentType: contentType,
                Metadata: {
                    uploadedAt: new Date().toISOString()
                }
            });
            const url = await (0, s3_request_presigner_1.getSignedUrl)(VideoController.s3Client, command, {
                expiresIn: 3600
            });
            // Return response wrapped in data property
            res.json({
                status: 'success',
                data: {
                    url,
                    videoId,
                    key
                }
            });
        }
        catch (error) {
            console.error('Upload URL generation error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to generate upload URL'
            });
        }
    }
    /**
     * Stream video preview
     */
    static async streamPreview(req, res, next) {
        try {
            const previewUrl = res.locals.previewUrl;
            if (!previewUrl) {
                res.status(404).json({
                    status: 'error',
                    code: 'NOT_FOUND',
                    message: "Preview not found"
                });
                return;
            }
            res.redirect(previewUrl);
        }
        catch (error) {
            next(error);
        }
    }
    // In VideoController class in video.controller.ts
    static async getAllVideos(req, res, next) {
        try {
            // Get all videos from service
            const videos = await video_service_1.VideoService.findAll();
            res.json({
                status: 'success',
                data: videos
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Stream full video
     */
    static async streamVideo(req, res, next) {
        try {
            const streamUrl = res.locals.streamUrl;
            if (!streamUrl) {
                res.status(404).json({
                    status: 'error',
                    code: 'NOT_FOUND',
                    message: "Video stream not found"
                });
                return;
            }
            if (req.headers.range) {
                try {
                    const { headers, stream } = await video_access_service_1.VideoAccessService.handlePartialContent(streamUrl, req.headers.range);
                    res.writeHead(206, headers);
                    stream.pipe(res);
                }
                catch (error) {
                    if (error instanceof types_1.VideoAccessError) {
                        res.status(416).json({
                            status: 'error',
                            code: 'INVALID_RANGE',
                            message: error.message
                        });
                        return;
                    }
                    throw error;
                }
            }
            else {
                res.redirect(streamUrl);
            }
        }
        catch (error) {
            next(error);
        }
    }
    // In VideoController
    // src/controllers/video.controller.ts
    // Update VideoController.ts to add checkAccess method
    static async checkAccess(req, res, next) {
        try {
            const { videoId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    status: 'error',
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required'
                });
                return;
            }
            // Check if user is owner
            const isOwner = await video_service_1.VideoService.isVideoOwner(videoId, userId);
            if (isOwner) {
                res.json({
                    status: 'success',
                    data: {
                        hasAccess: true,
                        isOwner: true
                    }
                });
                return;
            }
            // Check if user has purchased the video
            const paymentIntentId = req.body.paymentIntentId;
            const hasPurchased = await payment_service_1.PaymentService.verifyPurchase(userId, videoId, paymentIntentId);
            res.json({
                status: 'success',
                data: {
                    hasAccess: hasPurchased.verified,
                    isOwner: false
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    // Update PaymentController.ts createPaymentIntent
    static async createPaymentIntent(req, res, next) {
        try {
            const { videoId } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    status: 'error',
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required'
                });
                return;
            }
            const paymentIntent = await payment_service_1.PaymentService.createPaymentIntent(userId, videoId);
            res.json({
                status: 'success',
                data: paymentIntent
            });
        }
        catch (error) {
            if (error instanceof types_1.PaymentError) {
                res.status(400).json({
                    status: 'error',
                    code: error.code,
                    message: error.message
                });
                return;
            }
            next(error);
        }
    }
    static async getVideoUrls(req, res) {
        try {
            const { videoId } = req.params;
            // Add logging to debug
            console.log('Getting URLs for video:', videoId);
            const video = await video_service_1.VideoService.getVideo(videoId);
            if (!video) {
                console.log('Video not found:', videoId);
                return res.status(404).json({
                    status: 'error',
                    code: 'VIDEO_NOT_FOUND',
                    message: 'Video not found'
                });
            }
            // Add more logging
            console.log('Found video:', {
                id: video.id,
                hasFullUrl: !!video.fullVideoUrl,
                hasPreviewUrl: !!video.previewUrl
            });
            return res.json({
                status: 'success',
                data: {
                    streamingUrl: video.fullVideoUrl,
                    previewUrl: video.previewUrl,
                    thumbnailUrl: video.previewUrl // or a separate thumbnail if you have one
                }
            });
        }
        catch (error) {
            console.error('Error getting video URLs:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch video URLs'
            });
        }
    }
    /**
     * Download video
     */
    static async downloadVideo(req, res, next) {
        try {
            const downloadData = await video_access_service_1.VideoAccessService.processDownload(res.locals.downloadToken);
            if (!downloadData) {
                res.status(404).json({
                    status: 'error',
                    code: 'NOT_FOUND',
                    message: "Download not found or expired"
                });
                return;
            }
            res.setHeader('Content-Disposition', `attachment; filename="${downloadData.filename}"`);
            res.redirect(downloadData.url);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get stream URL
     */
    static async getStreamUrl(req, res, next) {
        try {
            const streamUrl = res.locals.streamUrl;
            if (!streamUrl) {
                res.status(404).json({
                    status: 'error',
                    code: 'NOT_FOUND',
                    message: "Stream URL not found"
                });
                return;
            }
            res.json({
                status: 'success',
                data: { url: streamUrl }
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Handle upload
     */
    static async uploadVideo(req, res, next) {
        try {
            if (!req.user?.id) {
                res.status(401).json({
                    status: 'error',
                    code: 'UNAUTHORIZED',
                    message: "Authentication required"
                });
                return;
            }
            if (!req.file) {
                res.status(400).json({
                    status: 'error',
                    code: 'NO_FILE',
                    message: "No video file provided"
                });
                return;
            }
            const urls = await video_service_1.VideoService.saveVideoFile(req.file, req.user.id);
            res.status(201).json({
                status: 'success',
                data: urls
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Create a new video
     */
    static async createVideo(req, res, next) {
        try {
            if (!req.user?.id) {
                res.status(401).json({
                    status: 'error',
                    code: 'UNAUTHORIZED',
                    message: "Authentication required"
                });
                return;
            }
            const videoData = (0, class_transformer_1.plainToClass)(video_dto_1.CreateVideoDto, req.body);
            const errors = await (0, class_validator_1.validate)(videoData);
            if (errors.length > 0) {
                res.status(400).json({
                    status: 'error',
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid video data',
                    errors: errors.map(err => ({
                        property: err.property,
                        constraints: err.constraints
                    }))
                });
                return;
            }
            const video = await video_service_1.VideoService.createVideo(req.user.id, videoData);
            res.status(201).json({
                status: 'success',
                data: video
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Error handler
     */
    static handleError(error, res) {
        if (error instanceof types_1.VideoAccessError) {
            res.status(403).json({
                status: 'error',
                code: 'ACCESS_DENIED',
                message: error.message
            });
            return;
        }
        if (error instanceof errors_1.ValidationError) {
            res.status(400).json({
                status: 'error',
                code: 'VALIDATION_ERROR',
                message: error.message
            });
            return;
        }
        if (error instanceof errors_1.StorageError) {
            res.status(500).json({
                status: 'error',
                code: 'STORAGE_ERROR',
                message: error.message
            });
            return;
        }
        res.status(500).json({
            status: 'error',
            code: 'SERVER_ERROR',
            message: 'An unexpected error occurred'
        });
    }
    static async getVideo(req, res, next) {
        try {
            const videoId = req.params.id;
            const userId = req.user?.id;
            const includePrivate = !!userId;
            const video = await video_service_1.VideoService.getVideo(videoId, includePrivate);
            if (!video) {
                res.status(404).json({
                    status: 'error',
                    code: 'NOT_FOUND',
                    message: "Video not found"
                });
                return;
            }
            const hasPurchased = userId ? await payment_service_1.PaymentService.hasUserPurchasedVideo(userId, videoId) : false;
            res.json({
                status: 'success',
                data: {
                    video,
                    hasPurchased
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateVideo(req, res, next) {
        try {
            if (!req.user?.id) {
                res.status(401).json({
                    status: 'error',
                    code: 'UNAUTHORIZED',
                    message: "Authentication required"
                });
                return;
            }
            const videoId = req.params.id;
            const updateData = (0, class_transformer_1.plainToClass)(video_dto_1.UpdateVideoDto, req.body);
            const errors = await (0, class_validator_1.validate)(updateData);
            if (errors.length > 0) {
                res.status(400).json({
                    status: 'error',
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid video update data',
                    errors: errors.map(err => ({
                        property: err.property,
                        constraints: err.constraints
                    }))
                });
                return;
            }
            const updatedVideo = await video_service_1.VideoService.updateVideo(videoId, req.user.id, updateData);
            if (!updatedVideo) {
                res.status(404).json({
                    status: 'error',
                    code: 'NOT_FOUND',
                    message: "Video not found"
                });
                return;
            }
            res.json({
                status: 'success',
                data: updatedVideo
            });
        }
        catch (error) {
            this.handleError(error, res);
        }
    }
    static async deleteVideo(req, res, next) {
        try {
            if (!req.user?.id) {
                res.status(401).json({
                    status: 'error',
                    code: 'UNAUTHORIZED',
                    message: "Authentication required"
                });
                return;
            }
            const videoId = req.params.id;
            const deleted = await video_service_1.VideoService.deleteVideo(videoId, req.user.id);
            if (!deleted) {
                res.status(404).json({
                    status: 'error',
                    code: 'NOT_FOUND',
                    message: "Video not found"
                });
                return;
            }
            res.json({
                status: 'success',
                message: 'Video deleted successfully'
            });
        }
        catch (error) {
            this.handleError(error, res);
        }
    }
    static async getUserVideos(req, res, next) {
        try {
            if (!req.user?.id) {
                res.status(401).json({
                    status: 'error',
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required'
                });
                return;
            }
            const { page, limit, sort, filter } = req.query;
            const videos = await video_service_1.VideoService.getUserVideos(req.user.id, {
                page: typeof page === 'string' ? parseInt(page, 10) : undefined,
                limit: typeof limit === 'string' ? parseInt(limit, 10) : undefined,
                sort: (typeof sort === 'string' && ['newest', 'oldest', 'popular'].includes(sort)) ? sort : undefined,
                filter: (typeof filter === 'string' && ['all', 'published', 'processing'].includes(filter)) ? filter : undefined
            });
            res.json({
                status: 'success',
                data: videos
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async searchVideos(req, res, next) {
        try {
            const { query, page, limit, minPrice, maxPrice, tags, sort } = req.query;
            const searchOptions = {
                page: typeof page === 'string' ? parseInt(page, 10) : undefined,
                limit: typeof limit === 'string' ? parseInt(limit, 10) : undefined,
                sort: typeof sort === 'string' ? sort : undefined,
                minPrice: typeof minPrice === 'string' ? parseFloat(minPrice) : undefined,
                maxPrice: typeof maxPrice === 'string' ? parseFloat(maxPrice) : undefined,
                tags: typeof tags === 'string' ? tags.split(',') : undefined
            };
            const searchResults = await video_service_1.VideoService.searchVideos(typeof query === 'string' ? query : '', searchOptions);
            res.json({
                status: 'success',
                data: searchResults
            });
        }
        catch (error) {
            next(error);
        }
    }
    // src/controllers/video.controller.ts
    // Add this method to your existing VideoController class
    static async verifyPurchase(req, res, next) {
        try {
            if (!req.user?.id) {
                res.status(401).json({
                    status: 'error',
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required'
                });
                return;
            }
            const userId = req.user.id;
            const { videoId } = req.params;
            if (!videoId) {
                res.status(400).json({
                    status: 'error',
                    code: 'BAD_REQUEST',
                    message: 'Video ID is required'
                });
                return;
            }
            // Check video ownership first
            const isOwner = await video_service_1.VideoService.isVideoOwner(videoId, userId);
            if (isOwner) {
                res.json({
                    status: 'success',
                    data: {
                        verified: true,
                        isOwner: true
                    }
                });
                return;
            }
            // Check if video is purchased
            const paymentIntentId = req.body.paymentIntentId;
            const isPurchased = await payment_service_1.PaymentService.verifyPurchase(userId, videoId, paymentIntentId);
            res.json({
                status: 'success',
                data: {
                    verified: isPurchased.verified,
                    isOwner: false
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getVideosForUser(req, res, next) {
        try {
            if (!req.user?.id) {
                res.status(401).json({
                    status: 'error',
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required'
                });
                return;
            }
            const userId = req.user.id;
            const allVideos = await this.videoRepository.find();
            const purchasedVideos = await this.purchaseRepository.find({ where: { userId, status: 'completed' } });
            const purchasedVideoIds = purchasedVideos.map(purchase => purchase.videoId);
            const availableVideos = allVideos.filter(video => !purchasedVideoIds.includes(video.id));
            res.json({
                status: 'success',
                data: availableVideos
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.VideoController = VideoController;
VideoController.videoRepository = database_1.AppDataSource.getRepository(video_model_1.Video);
VideoController.purchaseRepository = database_1.AppDataSource.getRepository(purchase_model_1.Purchase);
VideoController.s3Client = new client_s3_1.S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});
