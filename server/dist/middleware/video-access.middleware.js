"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoAccessMiddleware = void 0;
const video_access_service_1 = require("../services/video-access.service");
const types_1 = require("../types");
class VideoAccessMiddleware {
    /**
     * Middleware for accessing preview content
     * No authentication required
     */
    static async preview(req, res, next) {
        try {
            const videoId = req.params.videoId;
            if (!videoId) {
                return res.status(400).json({
                    message: "Video ID is required"
                });
            }
            const previewUrl = await video_access_service_1.VideoAccessService.getPreviewUrl(videoId);
            // Attach the URL to the response locals for the controller to use
            res.locals.previewUrl = previewUrl;
            next();
        }
        catch (error) {
            if (error instanceof types_1.VideoAccessError) {
                return res.status(404).json({
                    message: error.message
                });
            }
            return res.status(500).json({
                message: "Error accessing video preview"
            });
        }
    }
    /**
     * Middleware for accessing full video content
     * Requires authentication and valid purchase
     */
    static async fullAccess(req, res, next) {
        try {
            const videoId = req.params.videoId;
            const userId = req.user?.id;
            if (!videoId) {
                return res.status(400).json({
                    message: "Video ID is required"
                });
            }
            if (!userId) {
                return res.status(401).json({
                    message: "Authentication required"
                });
            }
            const streamingToken = await video_access_service_1.VideoAccessService.getStreamingToken(videoId, userId);
            if (!streamingToken) {
                return res.status(403).json({
                    message: "Video not purchased or access denied"
                });
            }
            // Attach the token to the response locals for the controller to use
            res.locals.streamingToken = streamingToken;
            next();
        }
        catch (error) {
            if (error instanceof types_1.VideoAccessError && error.message === 'Rate limit exceeded') {
                return res.status(429).json({
                    message: "Too many requests. Please try again later."
                });
            }
            return res.status(500).json({
                message: "Error accessing video content"
            });
        }
    }
    /**
     * Middleware for downloading videos
     * Requires authentication and valid purchase
     */
    static async download(req, res, next) {
        try {
            const videoId = req.params.videoId;
            const userId = req.user?.id;
            if (!videoId) {
                return res.status(400).json({
                    message: "Video ID is required"
                });
            }
            if (!userId) {
                return res.status(401).json({
                    message: "Authentication required"
                });
            }
            const downloadToken = await video_access_service_1.VideoAccessService.getDownloadToken(videoId, userId);
            if (!downloadToken) {
                return res.status(403).json({
                    message: "Video not purchased or access denied"
                });
            }
            // Attach the token to the response locals for the controller to use
            res.locals.downloadToken = downloadToken;
            next();
        }
        catch (error) {
            return res.status(500).json({
                message: "Error generating download token"
            });
        }
    }
    /**
     * Middleware for validating streaming tokens
     * Used for video stream requests
     */
    static async validateStream(req, res, next) {
        try {
            const { token } = req.query;
            if (!token || typeof token !== 'string') {
                return res.status(401).json({
                    message: "Valid streaming token is required"
                });
            }
            const streamUrl = await video_access_service_1.VideoAccessService.validateStreamingToken(token);
            if (!streamUrl) {
                return res.status(403).json({
                    message: "Invalid or expired streaming token"
                });
            }
            // Attach the stream URL to the response locals for the controller to use
            res.locals.streamUrl = streamUrl;
            next();
        }
        catch (error) {
            return res.status(500).json({
                message: "Error validating stream token"
            });
        }
    }
    /**
     * Middleware for handling CORS preflight requests for video content
     * This is important for video players in browsers
     */
    static cors(req, res, next) {
        res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL);
        res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        res.header('Access-Control-Expose-Headers', 'Content-Range, Content-Length');
        res.header('Access-Control-Allow-Credentials', 'true');
        if (req.method === 'OPTIONS') {
            return res.status(204).end();
        }
        next();
    }
    /**
     * Middleware for handling partial content requests
     * Essential for video streaming and seeking
     */
    static async handlePartialContent(req, res, next) {
        const range = req.headers.range;
        if (!range) {
            next();
            return;
        }
        res.locals.range = range;
        next();
    }
    /**
     * Middleware to check if video is currently being transcoded
     * Prevents access to videos that aren't ready yet
     */
    static async checkProcessingStatus(req, res, next) {
        const videoId = req.params.videoId;
        const processingKey = `processing:${videoId}`;
        const isProcessing = await video_access_service_1.VideoAccessService['redis'].get(processingKey);
        if (isProcessing === 'true') {
            return res.status(202).json({
                message: "Video is still being processed",
                status: "processing"
            });
        }
        next();
    }
    /**
     * Middleware to handle video format compatibility
     * Checks if the client supports the available video formats
     */
    static async handleFormatCompatibility(req, res, next) {
        const acceptHeader = req.headers.accept;
        const userAgent = req.headers['user-agent'];
        // Check if client supports HLS
        const supportsHLS = userAgent?.includes('Safari') ||
            userAgent?.includes('iOS') ||
            acceptHeader?.includes('application/vnd.apple.mpegurl');
        res.locals.preferredFormat = supportsHLS ? 'hls' : 'mp4';
        next();
    }
}
exports.VideoAccessMiddleware = VideoAccessMiddleware;
_a = VideoAccessMiddleware;
/**
 * Combines multiple middleware for full video access
 * Useful for routes that need complete video access control
 */
VideoAccessMiddleware.fullVideoAccess = [
    _a.cors,
    _a.checkProcessingStatus,
    _a.handleFormatCompatibility,
    _a.handlePartialContent,
    _a.fullAccess
];
