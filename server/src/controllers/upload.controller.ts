// src/controllers/upload.controller.ts
import { Request, Response } from 'express';
import { s3Service } from '../services/s3.service';
import { v4 as uuidv4 } from 'uuid';

export class UploadController {
  static async getUploadUrl(req: Request, res: Response) {
    try {
      const { contentType } = req.body;
      const videoId = uuidv4();

      // Validate content type
      const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
      if (!allowedTypes.includes(contentType)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid content type'
        });
      }

      // Get presigned URL
      const uploadData = await s3Service.getPresignedUploadUrlForVideo(
        videoId, 
        contentType
      );

      res.json({
        status: 'success',
        data: {
          ...uploadData,
          videoId
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

  static async getStreamingUrl(req: Request, res: Response) {
    try {
      const { videoId } = req.params;
      const url = await s3Service.getVideoStreamingUrl(videoId);

      res.json({
        status: 'success',
        data: { url }
      });
    } catch (error) {
      console.error('Streaming URL generation error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to generate streaming URL'
      });
    }
  }
}