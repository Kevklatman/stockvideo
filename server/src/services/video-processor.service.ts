// src/services/video-processor.service.ts
import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';
import { S3 } from 'aws-sdk';
import { createHash } from 'crypto';
import { 
  StorageError, 
  VideoProcessingError, 
  VideoPreset, 
  ProcessedVideo, 
  VideoUploadResult 
} from '../types';

export class VideoProcessorService {
  private static s3 = new S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
  });

  private static readonly QUALITY_PRESETS: { [key: string]: VideoPreset } = {
    '1080p': {
      resolution: '1920x1080',
      videoBitrate: '4000k',
      audioBitrate: '192k'
    },
    '720p': {
      resolution: '1280x720',
      videoBitrate: '2500k',
      audioBitrate: '128k'
    },
    '480p': {
      resolution: '854x480',
      videoBitrate: '1000k',
      audioBitrate: '96k'
    }
  };

  /**
   * Generates a 30-second preview of the video
   */
  static async generatePreview(inputPath: string, outputPath: string): Promise<void> {
    try {
      await fs.access(inputPath);
      
      return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .duration(30)
          .audioCodec('aac')
          .videoCodec('libx264')
          .outputOptions([
            '-preset fast',
            '-movflags +faststart',
            '-profile:v main',
            '-pix_fmt yuv420p',
            '-b:v 1500k',
            '-b:a 128k'
          ])
          .output(outputPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
    } catch (error: any) {
      throw new VideoProcessingError(`Preview generation failed: ${error.message}`);
    }
  }

  /**
   * Generates a thumbnail from the video
   */
  static async generateThumbnail(inputPath: string, outputPath: string): Promise<void> {
    try {
      await fs.access(inputPath);

      return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .screenshots({
            timestamps: ['00:00:01'],
            filename: path.basename(outputPath),
            folder: path.dirname(outputPath),
            size: '1280x720'
          })
          .on('end', resolve)
          .on('error', reject);
      });
    } catch (error: any) {
      throw new VideoProcessingError(`Thumbnail generation failed: ${error.message}`);
    }
  }

  /**
   * Processes the full video into multiple quality versions
   */
  static async processFullVideo(inputPath: string, outputDir: string): Promise<ProcessedVideo> {
    try {
      await fs.access(inputPath);
      await fs.mkdir(outputDir, { recursive: true });

      // Get video information
      const videoInfo = await this.getVideoInfo(inputPath);
      const videoHash = await this.generateFileHash(inputPath);
      
      // Process each quality version
      const qualities: { [key: string]: string } = {};
      for (const [quality, preset] of Object.entries(this.QUALITY_PRESETS)) {
        const outputPath = path.join(outputDir, `${videoHash}_${quality}.mp4`);
        await this.transcodeVideo(inputPath, outputPath, preset);
        qualities[quality] = outputPath;
      }

      // Generate preview and thumbnail
      const previewPath = path.join(outputDir, `${videoHash}_preview.mp4`);
      const thumbnailPath = path.join(outputDir, `${videoHash}_thumb.jpg`);
      
      await this.generatePreview(inputPath, previewPath);
      await this.generateThumbnail(inputPath, thumbnailPath);

      return {
        preview: previewPath,
        thumbnail: thumbnailPath,
        qualities,
        duration: videoInfo.duration
      };
    } catch (error: any) {
      throw new VideoProcessingError(`Video processing failed: ${error.message}`);
    }
  }

  /**
   * Gets video information (duration, resolution, etc.)
   */
  private static async getVideoInfo(inputPath: string): Promise<{ duration: number }> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) reject(err);
        resolve({
          duration: metadata.format.duration || 0
        });
      });
    });
  }

  /**
   * Generates a file hash for unique identification
   */
  private static async generateFileHash(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath);
    return createHash('md5').update(fileBuffer).digest('hex');
  }

  /**
   * Transcodes video to specific quality preset
   */
/**
   * Transcodes video to specific quality preset
   */
private static async transcodeVideo(
  inputPath: string,
  outputPath: string,
  preset: VideoPreset
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec('libx264')
      .videoBitrate(preset.videoBitrate)
      .audioCodec('aac')
      .audioBitrate(preset.audioBitrate)
      .size(preset.resolution)
      .outputOptions([
        '-preset fast',
        '-movflags +faststart',
        '-profile:v main',
        '-pix_fmt yuv420p'
      ])
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

  /**
   * Uploads processed video files to S3
   */
  static async uploadToS3(
    processedVideo: ProcessedVideo,
    videoId: string
  ): Promise<VideoUploadResult> {
    try {
      const uploads = [];
      const results = {
        previewUrl: '',
        thumbnailUrl: '',
        qualityUrls: {} as { [key: string]: string }
      };

      // Upload preview
      uploads.push(
        this.uploadFileToS3(
          processedVideo.preview,
          `previews/${videoId}/preview.mp4`
        ).then(url => results.previewUrl = url)
      );

      // Upload thumbnail
      uploads.push(
        this.uploadFileToS3(
          processedVideo.thumbnail,
          `thumbnails/${videoId}/thumbnail.jpg`
        ).then(url => results.thumbnailUrl = url)
      );

      // Upload each quality version
      for (const [quality, filePath] of Object.entries(processedVideo.qualities)) {
        uploads.push(
          this.uploadFileToS3(
            filePath,
            `videos/${videoId}/${quality}.mp4`
          ).then(url => results.qualityUrls[quality] = url)
        );
      }

      await Promise.all(uploads);
      return results;
    } catch (error: any) {
      throw new StorageError(`Failed to upload files to storage: ${error.message}`);
    }
  }

  /**
   * Uploads a single file to S3
   */
  private static async uploadFileToS3(filePath: string, key: string): Promise<string> {
    const fileContent = await fs.readFile(filePath);
    await this.s3.putObject({
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: key,
      Body: fileContent,
      ContentType: path.extname(filePath) === '.jpg' ? 'image/jpeg' : 'video/mp4'
    }).promise();

    return key;
  }

  /**
   * Deletes all video-related files from S3
   */
  static async deleteFromS3(videoId: string): Promise<void> {
    try {
      // Get list of all objects with the video ID prefix
      const objects = await this.s3.listObjectsV2({
        Bucket: process.env.AWS_BUCKET_NAME!,
        Prefix: `videos/${videoId}`
      }).promise();

      // Also get preview and thumbnail objects
      const additionalObjects = await Promise.all([
        this.s3.listObjectsV2({
          Bucket: process.env.AWS_BUCKET_NAME!,
          Prefix: `previews/${videoId}`
        }).promise(),
        this.s3.listObjectsV2({
          Bucket: process.env.AWS_BUCKET_NAME!,
          Prefix: `thumbnails/${videoId}`
        }).promise()
      ]);

      // Combine all objects
      const allObjects = [
        ...(objects.Contents || []),
        ...(additionalObjects[0].Contents || []),
        ...(additionalObjects[1].Contents || [])
      ];

      if (allObjects.length === 0) {
        return;
      }

      // Delete all objects
      await this.s3.deleteObjects({
        Bucket: process.env.AWS_BUCKET_NAME!,
        Delete: {
          Objects: allObjects.map(obj => ({ Key: obj.Key! })),
          Quiet: true
        }
      }).promise();

    } catch (error) {
      throw new StorageError(
        `Failed to delete video files from storage: ${(error as Error).message}`
      );
    }
  }

  /**
   * Deletes a single file from S3
   */
  static async deleteFileFromS3(key: string): Promise<void> {
    try {
      await this.s3.deleteObject({
        Bucket: process.env.AWS_BUCKET_NAME!,
        Key: key
      }).promise();
    } catch (error) {
      throw new StorageError(
        `Failed to delete file from storage: ${(error as Error).message}`
      );
    }
  }

  /**
   * Clean up all video files for a given ID
   */
  static async cleanupAllFiles(videoId: string): Promise<void> {
    try {
      // Delete from S3
      await this.deleteFromS3(videoId);

      // Clean up local temp files if they exist
      const tempDir = path.join(__dirname, '../../uploads/temp', videoId);
      await fs.rm(tempDir, { recursive: true, force: true });

    } catch (error) {
      throw new StorageError(
        `Failed to clean up video files: ${(error as Error).message}`
      );
    }
  }

  /**
   * Helper method to check if object exists in S3
   */
  private static async objectExists(key: string): Promise<boolean> {
    try {
      await this.s3.headObject({
        Bucket: process.env.AWS_BUCKET_NAME!,
        Key: key
      }).promise();
      return true;
    } catch (error) {
      if ((error as AWS.AWSError).code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }
}