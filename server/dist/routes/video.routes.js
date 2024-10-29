"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.videoRouter = void 0;
// src/routes/video.routes.ts
const express_1 = require("express");
const video_controller_1 = require("../controllers/video.controller");
const video_access_middleware_1 = require("../middleware/video-access.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
exports.videoRouter = router;
// Public routes
router.get("/:videoId/preview", video_access_middleware_1.VideoAccessMiddleware.preview, video_controller_1.VideoController.streamPreview);
// Protected routes
router.use(auth_middleware_1.authMiddleware);
// Full video access
router.get("/:videoId/stream", video_access_middleware_1.VideoAccessMiddleware.fullVideoAccess, video_controller_1.VideoController.streamVideo);
// Download route
router.get("/:videoId/download", video_access_middleware_1.VideoAccessMiddleware.download, video_controller_1.VideoController.downloadVideo);
// Stream validation route
router.get("/validate-stream", video_access_middleware_1.VideoAccessMiddleware.validateStream, video_controller_1.VideoController.getStreamUrl);
