import { NextFunction, RequestHandler } from "express";
import { VideoAccessService } from "../services/video-access.service";
import { 
  VideoAccessError,
  VideoRequestParams,
  StreamQueryParams,
  VideoResponseLocals,
  AuthenticatedVideoRequest 
} from "../types";
import { VideoService } from "../services/video.service";

export class VideoAccessMiddleware {
  /**
   * Middleware for accessing preview content
   * No authentication required
   */
  static preview: RequestHandler<
    VideoRequestParams,
    any,
    any,
    StreamQueryParams,
    VideoResponseLocals
  > = async (req, res, next): Promise<void> => {
    try {
      const { videoId } = req.params;
      
      if (!videoId) {
        res.status(400).json({ 
          message: "Video ID is required" 
        });
        return;
      }

      const previewUrl = await VideoAccessService.getPreviewUrl(videoId);
      
      res.locals.previewUrl = previewUrl;
      next();
    } catch (error) {
      if (error instanceof VideoAccessError) {
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
static fullVideoAccess: RequestHandler<
  VideoRequestParams,
  any,
  any,
  StreamQueryParams,
  VideoResponseLocals
> = async (req, res, next): Promise<void> => {
  try {
    const { videoId } = req.params;
    const userId = (req as AuthenticatedVideoRequest).user?.id;

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
    const isOwner = await VideoAccessService.isVideoOwner(videoId, userId);
    
    if (isOwner) {
      // If owner, bypass purchase check
      const streamingToken = await VideoAccessService.getStreamingToken(videoId, userId);
      if (streamingToken) {
        res.locals.streamingToken = streamingToken;
        next();
      } else {
        res.status(403).json({ 
          message: "Video not purchased or access denied" 
        });
      }
      return;
    }

    // If not owner, check for purchase
    const streamingToken = await VideoAccessService.getStreamingToken(videoId, userId);
    
    if (!streamingToken) {
      res.status(403).json({ 
        message: "Video not purchased or access denied" 
      });
      return;
    }

    res.locals.streamingToken = streamingToken;
    next();
  } catch (error) {
    if (error instanceof VideoAccessError && error.message === 'Rate limit exceeded') {
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
  static download: RequestHandler<
    VideoRequestParams,
    any,
    any,
    StreamQueryParams,
    VideoResponseLocals
  > = async (req, res, next): Promise<void> => {
    try {
      const { videoId } = req.params;
      const userId = (req as AuthenticatedVideoRequest).user?.id;

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

      const downloadToken = await VideoAccessService.getDownloadToken(videoId, userId);
      
      if (!downloadToken) {
        res.status(403).json({ 
          message: "Video not purchased or access denied" 
        });
        return;
      }

      res.locals.downloadToken = downloadToken;
      next();
    } catch (error) {
      res.status(500).json({ 
        message: "Error generating download token" 
      });
    }
  };
  static hasOwnerAccess: RequestHandler<
  VideoRequestParams,
  any,
  any,
  StreamQueryParams,
  VideoResponseLocals
> = async (req, res, next): Promise<void> => {
  try {
    const { videoId } = req.params;
    const userId = (req as AuthenticatedVideoRequest).user?.id;

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

    const isOwner = await VideoService.isVideoOwner(videoId, userId);
    
    if (isOwner) {
      res.locals.hasFullAccess = true;
      res.locals.isOwner = true;
      next();
      return;
    }

    // If not owner, continue to regular access check
    next();
  } catch (error) {
    res.status(500).json({ 
      message: "Error checking video ownership" 
    });
  }
};
  /**
   * Middleware for validating streaming tokens
   */
  static validateStream: RequestHandler<
    unknown,
    any,
    any,
    StreamQueryParams,
    VideoResponseLocals
  > = async (req, res, next): Promise<void> => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        res.status(401).json({ 
          message: "Valid streaming token is required" 
        });
        return;
      }

      const streamUrl = await VideoAccessService.validateStreamingToken(token);
      
      if (!streamUrl) {
        res.status(403).json({ 
          message: "Invalid or expired streaming token" 
        });
        return;
      }

      res.locals.streamUrl = streamUrl;
      next();
    } catch (error) {
      res.status(500).json({ 
        message: "Error validating stream token" 
      });
    }
  };

  /**
   * CORS handling middleware
   */
  static cors: RequestHandler<
    VideoRequestParams,
    any,
    any,
    StreamQueryParams,
    VideoResponseLocals
  > = (req, res, next): void => {
    res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL);
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization'
    );
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
  static handlePartialContent: RequestHandler<
    VideoRequestParams,
    any,
    any,
    StreamQueryParams,
    VideoResponseLocals
  > = (req, res, next): void => {
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
  static checkProcessingStatus: RequestHandler<
    VideoRequestParams,
    any,
    any,
    StreamQueryParams,
    VideoResponseLocals
  > = async (req, res, next): Promise<void> => {
    const { videoId } = req.params;
    const processingKey = `processing:${videoId}`;
    
    const isProcessing = await VideoAccessService['redis'].get(processingKey);
    
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
  static handleFormatCompatibility: RequestHandler<
    VideoRequestParams,
    any,
    any,
    StreamQueryParams,
    VideoResponseLocals
  > = (req, res, next): void => {
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
  static readonly middlewareChain = {
    fullVideoAccess: [
      VideoAccessMiddleware.cors,
      VideoAccessMiddleware.checkProcessingStatus,
      VideoAccessMiddleware.handleFormatCompatibility,
      VideoAccessMiddleware.handlePartialContent,
      VideoAccessMiddleware.hasOwnerAccess,
      VideoAccessMiddleware.fullVideoAccess
    ] as RequestHandler[],
    preview: [
      VideoAccessMiddleware.cors,
      VideoAccessMiddleware.checkProcessingStatus,
      VideoAccessMiddleware.preview
    ] as RequestHandler[],
    download: [
      VideoAccessMiddleware.cors,
      VideoAccessMiddleware.checkProcessingStatus,
      VideoAccessMiddleware.hasOwnerAccess,
      VideoAccessMiddleware.download
    ] as RequestHandler[],
    validateStream: [
      VideoAccessMiddleware.cors,
      VideoAccessMiddleware.validateStream
    ] as RequestHandler[]
  };
}