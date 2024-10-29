"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoProcessorService = void 0;
// src/services/video-processor.service.ts
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const aws_sdk_1 = require("aws-sdk");
const crypto_1 = require("crypto");
class VideoProcessorService {
    /**
     * Generates a 30-second preview of the video
     */
    static async generatePreview(inputPath, outputPath) {
        try {
            await fs_1.promises.access(inputPath);
            return new Promise((resolve, reject) => {
                (0, fluent_ffmpeg_1.default)(inputPath)
                    .setDuration(30)
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
        }
        catch (error) {
            throw new Error(`Preview generation failed: ${error.message}`);
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
                    timestamps: ['00:00:01'], // Take screenshot at 1 second
                    filename: path_1.default.basename(outputPath),
                    folder: path_1.default.dirname(outputPath),
                    size: '1280x720'
                })
                    .on('end', resolve)
                    .on('error', reject);
            });
        }
        catch (error) {
            throw new Error(`Thumbnail generation failed: ${error.message}`);
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
            throw new Error(`Video processing failed: ${error.message}`);
        }
    }
    /**
     * Generates HLS streams for adaptive streaming
     */
    static async generateHLSStream(inputPath, outputDir) {
        try {
            await fs_1.promises.access(inputPath);
            await fs_1.promises.mkdir(outputDir, { recursive: true });
            return new Promise((resolve, reject) => {
                (0, fluent_ffmpeg_1.default)(inputPath)
                    .outputOptions([
                    '-profile:v main',
                    '-sc_threshold 0',
                    '-g 48',
                    '-keyint_min 48',
                    '-hls_time 4',
                    '-hls_playlist_type vod',
                    '-hls_segment_filename', path_1.default.join(outputDir, 'segment_%03d.ts')
                ])
                    .output(path_1.default.join(outputDir, 'playlist.m3u8'))
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });
        }
        catch (error) {
            throw new Error(`HLS generation failed: ${error.message}`);
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
                .size(preset.resolution)
                .videoBitrate(preset.videoBitrate)
                .audioBitrate(preset.audioBitrate)
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
    static async uploadToS3(processedVideo, videoId) {
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
