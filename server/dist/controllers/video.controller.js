"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoController = void 0;
const video_service_1 = require("../services/video.service");
class VideoController {
    static async uploadVideo(req, res) {
        try {
            if (!req.user?.id) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            if (!req.file) {
                return res.status(400).json({ message: "No video file provided" });
            }
            const urls = await video_service_1.VideoService.saveVideoFile(req.file, req.user.id);
            res.status(201).json(urls);
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
    static async createVideo(req, res) {
        try {
            if (!req.user?.id) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            const video = await video_service_1.VideoService.createVideo(req.user.id, req.body);
            res.status(201).json(video);
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async getVideo(req, res) {
        try {
            const video = await video_service_1.VideoService.getVideo(req.params.id);
            if (!video) {
                return res.status(404).json({ message: "Video not found" });
            }
            res.json(video);
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
    static async getUserVideos(req, res) {
        try {
            if (!req.user?.id) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            const videos = await video_service_1.VideoService.getUserVideos(req.user.id);
            res.json(videos);
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
    static async updateVideo(req, res) {
        try {
            if (!req.user?.id) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            const video = await video_service_1.VideoService.updateVideo(req.params.id, req.user.id, req.body);
            if (!video) {
                return res.status(404).json({ message: "Video not found" });
            }
            res.json(video);
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async deleteVideo(req, res) {
        try {
            if (!req.user?.id) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            const success = await video_service_1.VideoService.deleteVideo(req.params.id, req.user.id);
            if (!success) {
                return res.status(404).json({ message: "Video not found" });
            }
            res.status(204).send();
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}
exports.VideoController = VideoController;
