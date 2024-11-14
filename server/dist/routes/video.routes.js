"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.videoRouter = void 0;
const express_1 = require("express");
const video_controller_1 = require("../controllers/video.controller");
const video_access_middleware_1 = require("../middleware/video-access.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const video_upload_middleware_1 = require("../middleware/video-upload.middleware");
const router = (0, express_1.Router)();
exports.videoRouter = router;
// Public routes
router.get("/:videoId/preview", ...video_access_middleware_1.VideoAccessMiddleware.middlewareChain.preview, video_controller_1.VideoController.streamPreview);
router.get('/', video_controller_1.VideoController.getAllVideos);
// Protected routes
router.use(auth_middleware_1.authMiddleware);
router.post("/upload-url", video_controller_1.VideoController.getUploadUrl);
router.post("/upload", video_upload_middleware_1.videoUpload.single('video'), video_upload_middleware_1.validateUploadedFile, video_upload_middleware_1.handleUploadError, video_controller_1.VideoController.uploadVideo);
router.get('/user', video_controller_1.VideoController.getUserVideos);
// Access verification - simplified to check if user has access
router.get('/:videoId/access', video_controller_1.VideoController.checkAccess);
// Full video access
router.get("/:videoId/stream", ...video_access_middleware_1.VideoAccessMiddleware.middlewareChain.fullVideoAccess, video_controller_1.VideoController.streamVideo);
router.get("/:videoId/download", ...video_access_middleware_1.VideoAccessMiddleware.middlewareChain.download, video_controller_1.VideoController.downloadVideo);
router.get("/validate-stream", ...video_access_middleware_1.VideoAccessMiddleware.middlewareChain.validateStream, video_controller_1.VideoController.getStreamUrl);
router.post('/', video_controller_1.VideoController.createVideo);
router.put('/:id', video_controller_1.VideoController.updateVideo);
router.delete('/:id', video_controller_1.VideoController.deleteVideo);
router.get('/search', video_controller_1.VideoController.searchVideos);
router.get("/:videoId/urls", auth_middleware_1.authMiddleware, video_controller_1.VideoController.getVideoUrls);
