"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoService = void 0;
// server/src/services/video.service.ts
const database_1 = require("../config/database");
const video_model_1 = require("../models/video.model");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const crypto = __importStar(require("crypto"));
class VideoService {
    constructor() {
        // Ensure uploads directory exists
        if (!fs.existsSync(VideoService.uploadDir)) {
            fs.mkdirSync(VideoService.uploadDir, { recursive: true });
        }
    }
    static async saveVideoFile(file, userId) {
        const fileId = crypto.randomBytes(16).toString('hex');
        const fileExt = path.extname(file.originalname);
        const fileName = `${fileId}${fileExt}`;
        const userDir = path.join(this.uploadDir, userId);
        // Create user directory if it doesn't exist
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }
        const filePath = path.join(userDir, fileName);
        // Save the file
        await fs.promises.writeFile(filePath, file.buffer);
        // For local development, we'll just use relative paths
        // In production, these would be CDN/storage URLs
        return {
            previewUrl: `/uploads/${userId}/${fileName}`,
            fullVideoUrl: `/uploads/${userId}/${fileName}`
        };
    }
    static async createVideo(userId, videoData) {
        const video = new video_model_1.Video();
        video.title = videoData.title;
        video.description = videoData.description;
        video.price = videoData.price;
        video.previewUrl = videoData.previewUrl;
        video.fullVideoUrl = videoData.fullVideoUrl;
        video.user = { id: userId };
        return this.videoRepository.save(video);
    }
    static async getVideo(videoId) {
        return this.videoRepository.findOne({
            where: { id: videoId },
            relations: ['user']
        });
    }
    static async getUserVideos(userId) {
        return this.videoRepository.find({
            where: { user: { id: userId } },
            order: { createdAt: 'DESC' }
        });
    }
    static async updateVideo(videoId, userId, updates) {
        const video = await this.videoRepository.findOne({
            where: { id: videoId, user: { id: userId } }
        });
        if (!video) {
            return null;
        }
        Object.assign(video, updates);
        return this.videoRepository.save(video);
    }
    static async deleteVideo(videoId, userId) {
        const video = await this.videoRepository.findOne({
            where: { id: videoId, user: { id: userId } }
        });
        if (!video) {
            return false;
        }
        // Delete the actual video files
        try {
            const fullPath = path.join(this.uploadDir, userId, path.basename(video.fullVideoUrl));
            if (fs.existsSync(fullPath)) {
                await fs.promises.unlink(fullPath);
            }
        }
        catch (error) {
            console.error('Error deleting video file:', error);
        }
        const result = await this.videoRepository.delete({
            id: videoId,
            user: { id: userId }
        });
        return result.affected ? result.affected > 0 : false;
    }
}
exports.VideoService = VideoService;
VideoService.videoRepository = database_1.AppDataSource.getRepository(video_model_1.Video);
VideoService.uploadDir = path.join(__dirname, '../../uploads');
