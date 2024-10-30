"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoProcessorService = void 0;
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const aws_sdk_1 = require("aws-sdk");
const crypto_1 = require("crypto");
const types_1 = require("../types");
class VideoProcessorService {
    /**
     * Generates a 30-second preview of the video
     */
    static async generatePreview(inputPath, outputPath) {
        try {
            await fs_1.promises.access(inputPath);
            return new Promise((resolve, reject) => {
                (0, fluent_ffmpeg_1.default)(inputPath)
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
                    .on('end', () => {
                    resolve();
                })
                    .on('error', reject)
                    .run();
            });
        }
        catch (error) {
            throw new types_1.VideoProcessingError(`Preview generation failed: ${error.message}`);
        }
    }
    /**
     * Generates a thumbnail from the video
     */
    static async generateThumbnail(inputPath, outputPath) {
        try {
            await fs_1.promises.access(inputPath);
            return new Promise((resolve, reject) => {
                (0, fluent_ffmpeg_1.default)(inputPath)
                    .screenshots({
                    timestamps: ['00:00:01'],
                    filename: path_1.default.basename(outputPath),
                    folder: path_1.default.dirname(outputPath),
                    size: '1280x720'
                })
                    .on('end', () => {
                    resolve();
                })
                    .on('error', reject);
            });
        }
        catch (error) {
            throw new types_1.VideoProcessingError(`Thumbnail generation failed: ${error.message}`);
        }
    }
    /**
     * Processes the full video into multiple quality versions
     */
    static async processFullVideo(inputPath, outputDir) {
        try {
            await fs_1.promises.access(inputPath);
            await fs_1.promises.mkdir(outputDir, { recursive: true });
            // Get video information
            const videoInfo = await this.getVideoInfo(inputPath);
            const videoHash = await this.generateFileHash(inputPath);
            // Process each quality version
            const qualities = {};
            for (const [quality, preset] of Object.entries(this.QUALITY_PRESETS)) {
                const outputPath = path_1.default.join(outputDir, `${videoHash}_${quality}.mp4`);
                await this.transcodeVideo(inputPath, outputPath, preset);
                qualities[quality] = outputPath;
            }
            // Generate preview and thumbnail
            const previewPath = path_1.default.join(outputDir, `${videoHash}_preview.mp4`);
            const thumbnailPath = path_1.default.join(outputDir, `${videoHash}_thumb.jpg`);
            await this.generatePreview(inputPath, previewPath);
            await this.generateThumbnail(inputPath, thumbnailPath);
            return {
                preview: previewPath,
                thumbnail: thumbnailPath,
                qualities,
                duration: videoInfo.duration
            };
        }
        catch (error) {
            throw new types_1.VideoProcessingError(`Video processing failed: ${error.message}`);
        }
    }
    /**
     * Gets video information (duration, resolution, etc.)
     */
    static async getVideoInfo(inputPath) {
        return new Promise((resolve, reject) => {
            fluent_ffmpeg_1.default.ffprobe(inputPath, (err, metadata) => {
                if (err)
                    reject(err);
                resolve({
                    duration: metadata.format.duration || 0
                });
            });
        });
    }
    /**
     * Generates a file hash for unique identification
     */
    static async generateFileHash(filePath) {
        const fileBuffer = await fs_1.promises.readFile(filePath);
        return (0, crypto_1.createHash)('md5').update(fileBuffer).digest('hex');
    }
    /**
     * Transcodes video to specific quality preset
     */
    static async transcodeVideo(inputPath, outputPath, preset) {
        return new Promise((resolve, reject) => {
            (0, fluent_ffmpeg_1.default)(inputPath)
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
                .on('end', () => {
                resolve();
            })
                .on('error', reject)
                .run();
        });
    }
    /**
     * Uploads processed video files to S3
     */
    static async uploadToS3(processedVideo, videoId) {
        try {
            const uploads = [];
            const results = {
                previewUrl: '',
                thumbnailUrl: '',
                qualityUrls: {}
            };
            // Upload preview
            uploads.push(this.uploadFileToS3(processedVideo.preview, `previews/${videoId}/preview.mp4`).then(url => results.previewUrl = url));
            // Upload thumbnail
            uploads.push(this.uploadFileToS3(processedVideo.thumbnail, `thumbnails/${videoId}/thumbnail.jpg`).then(url => results.thumbnailUrl = url));
            // Upload each quality version
            for (const [quality, filePath] of Object.entries(processedVideo.qualities)) {
                uploads.push(this.uploadFileToS3(filePath, `videos/${videoId}/${quality}.mp4`).then(url => results.qualityUrls[quality] = url));
            }
            await Promise.all(uploads);
            return results;
        }
        catch (error) {
            throw new types_1.StorageError(`Failed to upload files to storage: ${error.message}`);
        }
    }
    /**
     * Uploads a single file to S3
     */
    static async uploadFileToS3(filePath, key) {
        const fileContent = await fs_1.promises.readFile(filePath);
        await this.s3.putObject({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key,
            Body: fileContent,
            ContentType: path_1.default.extname(filePath) === '.jpg' ? 'image/jpeg' : 'video/mp4'
        }).promise();
        return key;
    }
    /**
     * Deletes all video-related files from S3
     */
    static async deleteFromS3(videoId) {
        try {
            // Get list of all objects with the video ID prefix
            const objects = await this.s3.listObjectsV2({
                Bucket: process.env.AWS_BUCKET_NAME,
                Prefix: `videos/${videoId}`
            }).promise();
            // Also get preview and thumbnail objects
            const additionalObjects = await Promise.all([
                this.s3.listObjectsV2({
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Prefix: `previews/${videoId}`
                }).promise(),
                this.s3.listObjectsV2({
                    Bucket: process.env.AWS_BUCKET_NAME,
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
                Bucket: process.env.AWS_BUCKET_NAME,
                Delete: {
                    Objects: allObjects.map(obj => ({ Key: obj.Key })),
                    Quiet: true
                }
            }).promise();
        }
        catch (error) {
            throw new types_1.StorageError(`Failed to delete video files from storage: ${error.message}`);
        }
    }
    /**
     * Deletes a single file from S3
     */
    static async deleteFileFromS3(key) {
        try {
            await this.s3.deleteObject({
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: key
            }).promise();
        }
        catch (error) {
            throw new types_1.StorageError(`Failed to delete file from storage: ${error.message}`);
        }
    }
    /**
     * Clean up all video files for a given ID
     */
    static async cleanupAllFiles(videoId) {
        try {
            // Delete from S3
            await this.deleteFromS3(videoId);
            // Clean up local temp files if they exist
            const tempDir = path_1.default.join(__dirname, '../../uploads/temp', videoId);
            await fs_1.promises.rm(tempDir, { recursive: true, force: true });
        }
        catch (error) {
            throw new types_1.StorageError(`Failed to clean up video files: ${error.message}`);
        }
    }
    /**
     * Helper method to check if object exists in S3
     */
    static async objectExists(key) {
        try {
            await this.s3.headObject({
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: key
            }).promise();
            return true;
        }
        catch (error) {
            if (error.code === 'NotFound') {
                return false;
            }
            throw error;
        }
    }
}
exports.VideoProcessorService = VideoProcessorService;
VideoProcessorService.s3 = new aws_sdk_1.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});
VideoProcessorService.QUALITY_PRESETS = {
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
