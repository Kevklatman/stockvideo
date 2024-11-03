// src/routes/video.routes.ts
import { Router, Request, Response, NextFunction } from "express";
import { VideoController } from "../controllers/video.controller";
import { VideoAccessMiddleware } from "../middleware/video-access.middleware";
import { authMiddleware } from "../middleware/auth.middleware";
import { 
  videoUpload, 
  handleUploadError, 
  validateUploadedFile 
} from "../middleware/video-upload.middleware";
import { UploadController } from "../controllers/upload.controller";
import { MulterError } from 'multer';

const router = Router();

// Error handling middleware with proper typing
const uploadErrorHandler = (
  err: Error | MulterError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof MulterError) {
    handleUploadError(err, req, res, next);
  } else {
    next(err);
  }
};

// Public routes
router.get(
  "/:videoId/preview",
  ...VideoAccessMiddleware.middlewareChain.preview,
  VideoController.streamPreview
);

// Get all videos
router.get(
  '/',
  VideoController.getAllVideos
);

// Protected routes
router.use(authMiddleware);

// Upload route with proper middleware chain and error handling
router.post(
  "/upload",
  videoUpload.single('video'),
  validateUploadedFile,
  uploadErrorHandler,
  VideoController.uploadVideo
);

// Get user videos
router.get(
  '/user',
  VideoController.getUserVideos
);

// Verify purchase
router.post(
  '/:videoId/verify',
  authMiddleware,
  VideoController.verifyPurchase
);

// Full video access
router.get(
  "/:videoId/stream",
  ...VideoAccessMiddleware.middlewareChain.fullVideoAccess,
  VideoController.streamVideo
);

// Download route
router.get(
  "/:videoId/download",
  ...VideoAccessMiddleware.middlewareChain.download,
  VideoController.downloadVideo
);

// Stream validation route
router.get(
  "/validate-stream",
  ...VideoAccessMiddleware.middlewareChain.validateStream,
  VideoController.getStreamUrl
);

// Create video
router.post(
  '/',
  VideoController.createVideo
);

// Update video
router.put(
  '/:id',
  VideoController.updateVideo
);

// Delete video
router.delete(
  '/:id',
  VideoController.deleteVideo
);

// Search videos
router.get(
  '/search',
  VideoController.searchVideos
);

// Get video URLs
router.get(
  "/:videoId/urls",
  authMiddleware,
  VideoController.getVideoUrls
);

// Upload URL routes
router.post(
  '/upload-url',
  authMiddleware,
  UploadController.getUploadUrl
);

export { router as videoRouter };