import { Router } from "express";
import { VideoController } from "../controllers/video.controller";
import { VideoAccessMiddleware } from "../middleware/video-access.middleware";
import { authMiddleware } from "../middleware/auth.middleware";
import { 
  videoUpload, 
  handleUploadError, 
  validateUploadedFile 
} from "../middleware/video-upload.middleware";

const router = Router();

// Public routes
router.get(
  "/:videoId/preview",
  ...VideoAccessMiddleware.middlewareChain.preview,
  VideoController.streamPreview
);

router.get('/', VideoController.getAllVideos);

// Protected routes
router.use(authMiddleware);

router.post(
  "/upload",
  videoUpload.single('video'),
  validateUploadedFile,
  handleUploadError,
  VideoController.uploadVideo
);

router.get('/user', VideoController.getUserVideos);

// Access verification - simplified to check if user has access
router.get(
  '/:videoId/access',
  VideoController.checkAccess
);

// Full video access
router.get(
  "/:videoId/stream",
  ...VideoAccessMiddleware.middlewareChain.fullVideoAccess,
  VideoController.streamVideo
);

router.get(
  "/:videoId/download",
  ...VideoAccessMiddleware.middlewareChain.download,
  VideoController.downloadVideo
);

router.get(
  "/validate-stream",
  ...VideoAccessMiddleware.middlewareChain.validateStream,
  VideoController.getStreamUrl
);

router.post('/', VideoController.createVideo);
router.put('/:id', VideoController.updateVideo);
router.delete('/:id', VideoController.deleteVideo);
router.get('/search', VideoController.searchVideos);
router.get("/:videoId/urls", authMiddleware, VideoController.getVideoUrls);

export { router as videoRouter };