"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoController = void 0;
const video_service_1 = require("../services/video.service");
const video_access_service_1 = require("../services/video-access.service");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const video_dto_1 = require("../dtos/video.dto");
const errors_1 = require("../types/errors");
class VideoController {
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
                    if (error instanceof errors_1.VideoAccessError) {
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
        if (error instanceof errors_1.VideoAccessError) {
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
            const includePrivate = !!req.user?.id;
            const video = await video_service_1.VideoService.getVideo(videoId, includePrivate);
            if (!video) {
                res.status(404).json({
                    status: 'error',
                    code: 'NOT_FOUND',
                    message: "Video not found"
                });
                return;
            }
            res.json({
                status: 'success',
                data: video
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
}
exports.VideoController = VideoController;
