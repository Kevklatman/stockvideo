// src/controllers/video.controller.ts
import { Request, Response, NextFunction } from "express";
import { VideoService } from "../services/video.service";
import { VideoAccessService } from "../services/video-access.service";
import { AuthRequest } from "../middleware/auth.middleware";
import { plainToClass } from "class-transformer";
import { validate } from "class-validator";
import { CreateVideoDto, UpdateVideoDto, VideoSearchDto } from "../dtos/video.dto";
import { 
  VideoProcessingError, 
  VideoAccessError, 
  ValidationError,
  StorageError 
} from "../types/errors";
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

export class VideoController {
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
              message: error.message
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
static async getVideoUrls(req: Request, res: Response) {
  try {
    const { videoId } = req.params;
    const video = await VideoService.getVideo(videoId);

    if (!video) {
      return res.status(404).json({
        status: 'error',
        message: 'Video not found'
      });
    }

    return res.json({
      status: 'success',
      data: {
        fullVideoUrl: video.fullVideoUrl,
        previewUrl: video.previewUrl
      }
    });
  } catch (error) {
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
        message: error.message
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
    req: Request, 
    res: Response, 
    next: NextFunction
  ): Promise<void> {
    try {
      const videoId = req.params.id;
      const includePrivate = !!(req as AuthRequest).user?.id;

      const video = await VideoService.getVideo(videoId, includePrivate);

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
}