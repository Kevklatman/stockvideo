"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoAccessMiddleware = void 0;
const video_access_service_1 = require("../services/video-access.service");
const types_1 = require("../types");
const video_service_1 = require("../services/video.service");
class VideoAccessMiddleware {
}
exports.VideoAccessMiddleware = VideoAccessMiddleware;
_a = VideoAccessMiddleware;
/**
 * Middleware for accessing preview content
 * No authentication required
 */
VideoAccessMiddleware.preview = async (req, res, next) => {
    try {
        const { videoId } = req.params;
        if (!videoId) {
            res.status(400).json({
                message: "Video ID is required"
            });
            return;
        }
        const previewUrl = await video_access_service_1.VideoAccessService.getPreviewUrl(videoId);
        res.locals.previewUrl = previewUrl;
        next();
    }
    catch (error) {
        if (error instanceof types_1.VideoAccessError) {
            res.status(404).json({
                message: error.message
            });
            return;
        }
        res.status(500).json({
            message: "Error accessing video preview"
        });
    }
};
/**
 * Middleware for accessing full video content
 */
VideoAccessMiddleware.fullVideoAccess = async (req, res, next) => {
    try {
        const { videoId } = req.params;
        const userId = req.user?.id;
        if (!videoId) {
            res.status(400).json({
                message: "Video ID is required"
            });
            return;
        }
        if (!userId) {
            res.status(401).json({
                message: "Authentication required"
            });
            return;
        }
        // Check if user is the owner
        const isOwner = await video_access_service_1.VideoAccessService.isVideoOwner(videoId, userId);
        if (isOwner) {
            // If owner, bypass purchase check
            const streamingToken = await video_access_service_1.VideoAccessService.getStreamingToken(videoId, userId);
            if (streamingToken) {
                res.locals.streamingToken = streamingToken;
                next();
            }
            else {
                res.status(403).json({
                    message: "Video not purchased or access denied"
                });
            }
            return;
        }
        // If not owner, check for purchase
        const streamingToken = await video_access_service_1.VideoAccessService.getStreamingToken(videoId, userId);
        if (!streamingToken) {
            res.status(403).json({
                message: "Video not purchased or access denied"
            });
            return;
        }
        res.locals.streamingToken = streamingToken;
        next();
    }
    catch (error) {
        if (error instanceof types_1.VideoAccessError && error.message === 'Rate limit exceeded') {
            res.status(429).json({
                message: "Too many requests. Please try again later."
            });
            return;
        }
        res.status(500).json({
            message: "Error accessing video content"
        });
    }
};
/**
 * Middleware for downloading videos
 */
VideoAccessMiddleware.download = async (req, res, next) => {
    try {
        const { videoId } = req.params;
        const userId = req.user?.id;
        if (!videoId) {
            res.status(400).json({
                message: "Video ID is required"
            });
            return;
        }
        if (!userId) {
            res.status(401).json({
                message: "Authentication required"
            });
            return;
        }
        const downloadToken = await video_access_service_1.VideoAccessService.getDownloadToken(videoId, userId);
        if (!downloadToken) {
            res.status(403).json({
                message: "Video not purchased or access denied"
            });
            return;
        }
        res.locals.downloadToken = downloadToken;
        next();
    }
    catch (error) {
        res.status(500).json({
            message: "Error generating download token"
        });
    }
};
VideoAccessMiddleware.hasOwnerAccess = async (req, res, next) => {
    try {
        const { videoId } = req.params;
        const userId = req.user?.id;
        if (!videoId) {
            res.status(400).json({
                message: "Video ID is required"
            });
            return;
        }
        if (!userId) {
            res.status(401).json({
                message: "Authentication required"
            });
            return;
        }
        const isOwner = await video_service_1.VideoService.isVideoOwner(videoId, userId);
        if (isOwner) {
            res.locals.hasFullAccess = true;
            res.locals.isOwner = true;
            next();
            return;
        }
        // If not owner, continue to regular access check
        next();
    }
    catch (error) {
        res.status(500).json({
            message: "Error checking video ownership"
        });
    }
};
/**
 * Middleware for validating streaming tokens
 */
VideoAccessMiddleware.validateStream = async (req, res, next) => {
    try {
        const { token } = req.query;
        if (!token || typeof token !== 'string') {
            res.status(401).json({
                message: "Valid streaming token is required"
            });
            return;
        }
        const streamUrl = await video_access_service_1.VideoAccessService.validateStreamingToken(token);
        if (!streamUrl) {
            res.status(403).json({
                message: "Invalid or expired streaming token"
            });
            return;
        }
        res.locals.streamUrl = streamUrl;
        next();
    }
    catch (error) {
        res.status(500).json({
            message: "Error validating stream token"
        });
    }
};
/**
 * CORS handling middleware
 */
VideoAccessMiddleware.cors = (req, res, next) => {
    res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL);
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Expose-Headers', 'Content-Range, Content-Length');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }
    next();
};
/**
 * Partial content handling middleware
 */
VideoAccessMiddleware.handlePartialContent = (req, res, next) => {
    const range = req.headers.range;
    if (!range) {
        next();
        return;
    }
    res.locals.range = range;
    next();
};
/**
 * Processing status check middleware
 */
VideoAccessMiddleware.checkProcessingStatus = async (req, res, next) => {
    const { videoId } = req.params;
    const processingKey = `processing:${videoId}`;
    const isProcessing = await video_access_service_1.VideoAccessService['redis'].get(processingKey);
    if (isProcessing === 'true') {
        res.status(202).json({
            message: "Video is still being processed",
            status: "processing"
        });
        return;
    }
    next();
};
/**
 * Format compatibility middleware
 */
VideoAccessMiddleware.handleFormatCompatibility = (req, res, next) => {
    const acceptHeader = req.headers.accept;
    const userAgent = req.headers['user-agent'];
    const supportsHLS = userAgent?.includes('Safari') ||
        userAgent?.includes('iOS') ||
        acceptHeader?.includes('application/vnd.apple.mpegurl');
    res.locals.preferredFormat = supportsHLS ? 'hls' : 'mp4';
    next();
};
/**
 * Middleware chains
 */
VideoAccessMiddleware.middlewareChain = {
    fullVideoAccess: [
        _a.cors,
        _a.checkProcessingStatus,
        _a.handleFormatCompatibility,
        _a.handlePartialContent,
        _a.hasOwnerAccess,
        _a.fullVideoAccess
    ],
    preview: [
        _a.cors,
        _a.checkProcessingStatus,
        _a.preview
    ],
    download: [
        _a.cors,
        _a.checkProcessingStatus,
        _a.hasOwnerAccess,
        _a.download
    ],
    validateStream: [
        _a.cors,
        _a.validateStream
    ]
};
