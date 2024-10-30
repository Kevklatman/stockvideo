"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.videoRouter = void 0;
// src/routes/video.routes.ts
const express_1 = require("express");
const video_controller_1 = require("../controllers/video.controller");
const video_access_middleware_1 = require("../middleware/video-access.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const video_upload_middleware_1 = require("../middleware/video-upload.middleware");
const router = (0, express_1.Router)();
exports.videoRouter = router;
// Public routes
router.get("/:videoId/preview", ...video_access_middleware_1.VideoAccessMiddleware.middlewareChain.preview, video_controller_1.VideoController.streamPreview);
// Protected routes
router.use(auth_middleware_1.authMiddleware);
// Upload route with proper middleware chain
router.post("/upload", video_upload_middleware_1.videoUpload.single('video'), video_upload_middleware_1.validateUploadedFile, (err, req, res, next) => {
    if (err) {
        (0, video_upload_middleware_1.handleUploadError)(err, req, res, next);
    }
    else {
        next();
    }
}, video_controller_1.VideoController.uploadVideo);
// Get user videos
router.get('/user', video_controller_1.VideoController.getUserVideos);
// Full video access
router.get("/:videoId/stream", ...video_access_middleware_1.VideoAccessMiddleware.middlewareChain.fullVideoAccess, video_controller_1.VideoController.streamVideo);
// Download route
router.get("/:videoId/download", ...video_access_middleware_1.VideoAccessMiddleware.middlewareChain.download, video_controller_1.VideoController.downloadVideo);
// Stream validation route
router.get("/validate-stream", ...video_access_middleware_1.VideoAccessMiddleware.middlewareChain.validateStream, video_controller_1.VideoController.getStreamUrl);
// Create video
router.post('/', video_controller_1.VideoController.createVideo);
// Update video
router.put('/:id', video_controller_1.VideoController.updateVideo);
// Delete video
router.delete('/:id', video_controller_1.VideoController.deleteVideo);
// Search videos
router.get('/search', video_controller_1.VideoController.searchVideos);
