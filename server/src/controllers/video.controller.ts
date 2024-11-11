// src/controllers/video.controller.ts
import { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../config/database";
import { Video } from "../models/video.model";
import { Purchase } from "../models/purchase.model";
import { VideoService } from "../services/video.service";
import { VideoAccessService } from "../services/video-access.service";
import { AuthRequest } from "../middleware/auth.middleware";
import { plainToClass } from "class-transformer";
import { validate } from "class-validator";
import { CreateVideoDto, UpdateVideoDto, VideoSearchDto } from "../dtos/video.dto";
import { 
  ValidationError,
  StorageError 
} from "../types/errors";
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { PaymentService } from "../services/payment.service";
import { AuthenticatedRequest, PaymentError, VideoAccessError } from "../types";

export class VideoController {
  private static videoRepository = AppDataSource.getRepository(Video);
  private static purchaseRepository = AppDataSource.getRepository(Purchase);
  private static s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

// src/controllers/upload.controller.ts
// src/controllers/upload.controller.ts
static async getUploadUrl(req: Request, res: Response) {
  try {
    const { contentType } = req.body;

    if (!contentType) {
      return res.status(400).json({
        status: 'error',
        message: 'Content type is required'
      });
    }

    const videoId = crypto.randomUUID();
    const key = `videos/${videoId}`;

    // Generate the signed URL
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: key,
      ContentType: contentType,
      Metadata: {
        uploadedAt: new Date().toISOString()
      }
    });

    const url = await getSignedUrl(VideoController.s3Client, command, { 
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
  } catch (error) {
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
  static async streamPreview(
    req: Request, 
    res: Response, 
    next: NextFunction
  ): Promise<void> {
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
    } catch (error) {
      next(error);
    }
  }
// In VideoController class in video.controller.ts

static async getAllVideos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Get all videos from service
    const videos = await VideoService.findAll();

    res.json({
      status: 'success',
      data: videos
    });
  } catch (error) {
    next(error);
  }
}
  /**
   * Stream full video
   */
  static async streamVideo(
    req: Request, 
    res: Response, 
    next: NextFunction
  ): Promise<void> {
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
          const { headers, stream } = await VideoAccessService.handlePartialContent(
            streamUrl,
            req.headers.range
          );

          res.writeHead(206, headers);
          stream.pipe(res);
        } catch (error) {
          if (error instanceof VideoAccessError) {
            res.status(416).json({
              status: 'error',
              code: 'INVALID_RANGE',
              message: (error as Error).message
            });
            return;
          }
          throw error;
        }
      } else {
        res.redirect(streamUrl);
      }
    } catch (error) {
      next(error);
    }
  }
// In VideoController
// src/controllers/video.controller.ts
// Update VideoController.ts to add checkAccess method
static async checkAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
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
    const isOwner = await VideoService.isVideoOwner(videoId, userId);

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
    const hasPurchased = await PaymentService.verifyPurchase(userId, videoId, paymentIntentId);

    res.json({
      status: 'success',
      data: {
        hasAccess: hasPurchased.verified,
        isOwner: false
      }
    });
  } catch (error) {
    next(error);
  }
}

// Update PaymentController.ts createPaymentIntent
static async createPaymentIntent(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
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

    const paymentIntent = await PaymentService.createPaymentIntent(
      userId,
      videoId
    );

    res.json({
      status: 'success',
      data: paymentIntent
    });
  } catch (error) {
    if (error instanceof PaymentError) {
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
static async getVideoUrls(req: Request, res: Response) {
  try {
    const { videoId } = req.params;
    
    // Add logging to debug
    console.log('Getting URLs for video:', videoId);

    const video = await VideoService.getVideo(videoId);

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
  } catch (error) {
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
  static async downloadVideo(
    req: Request, 
    res: Response, 
    next: NextFunction
  ): Promise<void> {
    try {
      const downloadData = await VideoAccessService.processDownload(
        res.locals.downloadToken
      );
      
      if (!downloadData) {
        res.status(404).json({
          status: 'error',
          code: 'NOT_FOUND',
          message: "Download not found or expired"
        });
        return;
      }

      res.setHeader(
        'Content-Disposition', 
        `attachment; filename="${downloadData.filename}"`
      );
      res.redirect(downloadData.url);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get stream URL
   */
  static async getStreamUrl(
    req: Request, 
    res: Response, 
    next: NextFunction
  ): Promise<void> {
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
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle upload
   */
  static async uploadVideo(
    req: AuthRequest, 
    res: Response, 
    next: NextFunction
  ): Promise<void> {
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

      const urls = await VideoService.saveVideoFile(req.file, req.user.id);
      
      res.status(201).json({
        status: 'success',
        data: urls
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new video
   */
  static async createVideo(
    req: AuthRequest, 
    res: Response, 
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          status: 'error',
          code: 'UNAUTHORIZED',
          message: "Authentication required"
        });
        return;
      }

      const videoData = plainToClass(CreateVideoDto, req.body);
      const errors = await validate(videoData);

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

      const video = await VideoService.createVideo(req.user.id, videoData);

      res.status(201).json({
        status: 'success',
        data: video
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Error handler
   */
  private static handleError(error: unknown, res: Response): void {
    if (error instanceof VideoAccessError) {
      res.status(403).json({
        status: 'error',
        code: 'ACCESS_DENIED',
        message: (error as Error).message
      });
      return;
    }

    if (error instanceof ValidationError) {
      res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: error.message
      });
      return;
    }

    if (error instanceof StorageError) {
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

  static async getVideo(
    req: AuthRequest, 
    res: Response, 
    next: NextFunction
  ): Promise<void> {
    try {
      const videoId = req.params.id;
      const userId = req.user?.id;
      const includePrivate = !!userId;

      const video = await VideoService.getVideo(videoId, includePrivate);

      if (!video) {
        res.status(404).json({
          status: 'error',
          code: 'NOT_FOUND',
          message: "Video not found"
        });
        return;
      }

      const hasPurchased = userId ? await PaymentService.hasUserPurchasedVideo(userId, videoId) : false;

      res.json({
        status: 'success',
        data: {
          video,
          hasPurchased
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateVideo(
    req: AuthRequest, 
    res: Response, 
    next: NextFunction
  ): Promise<void> {
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
      const updateData = plainToClass(UpdateVideoDto, req.body);
      const errors = await validate(updateData);
  
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
  
      const updatedVideo = await VideoService.updateVideo(
        videoId,
        req.user.id,
        updateData
      );
  
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
    } catch (error) {
      this.handleError(error, res);
    }
  }
  static async deleteVideo(
    req: AuthRequest,
    res: Response,
    next: NextFunction
    ): Promise<void> {
    try {
    if (!req.user?.id) {
    res.status(401).json({
    status: 'error',
    code: 'UNAUTHORIZED',
    message: "Authentication required"
    });
    return;
    } const videoId = req.params.id; const deleted = await VideoService.deleteVideo(videoId, req.user.id); if (!deleted) {
    res.status(404).json({
    status: 'error',
    code: 'NOT_FOUND',
    message: "Video not found"
    });
    return;
    } res.json({
    status: 'success',
    message: 'Video deleted successfully'
    });
    } catch (error) {
    this.handleError(error, res);
    }
    }
    static async getUserVideos(
      req: AuthRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> {
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
        const videos = await VideoService.getUserVideos(req.user.id, {
          page: typeof page === 'string' ? parseInt(page, 10) : undefined,
          limit: typeof limit === 'string' ? parseInt(limit, 10) : undefined,
          sort: (typeof sort === 'string' && ['newest', 'oldest', 'popular'].includes(sort)) ? sort as 'newest' | 'oldest' | 'popular' : undefined,
          filter: (typeof filter === 'string' && ['all', 'published', 'processing'].includes(filter)) ? filter as 'all' | 'published' | 'processing' : undefined
        });
    
        res.json({
          status: 'success',
          data: videos
        });
      } catch (error) {
        next(error);
      }
    }

    static async searchVideos(
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> {
      try {
        const { query, page, limit, minPrice, maxPrice, tags, sort } = req.query;
        const searchOptions: {
          page?: number;
          limit?: number;
          sort?: string;
          minPrice?: number;
          maxPrice?: number;
          tags?: string[];
        } = {
          page: typeof page === 'string' ? parseInt(page, 10) : undefined,
          limit: typeof limit === 'string' ? parseInt(limit, 10) : undefined,
          sort: typeof sort === 'string' ? sort : undefined,
          minPrice: typeof minPrice === 'string' ? parseFloat(minPrice) : undefined,
          maxPrice: typeof maxPrice === 'string' ? parseFloat(maxPrice) : undefined,
          tags: typeof tags === 'string' ? tags.split(',') : undefined
        };
    
        const searchResults = await VideoService.searchVideos(
          typeof query === 'string' ? query : '',
          searchOptions
        );
    
        res.json({
          status: 'success',
          data: searchResults
        });
      } catch (error) {
        next(error);
      }
    }

    // src/controllers/video.controller.ts

// Add this method to your existing VideoController class
static async verifyPurchase(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
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
    const isOwner = await VideoService.isVideoOwner(videoId, userId);
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
    const isPurchased = await PaymentService.verifyPurchase(userId, videoId, paymentIntentId);
    
    res.json({
      status: 'success',
      data: {
        verified: isPurchased.verified,
        isOwner: false
      }
    });
  } catch (error) {
    next(error);
  }
}

static async getVideosForUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
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
  } catch (error) {
    next(error);
  }
}
}