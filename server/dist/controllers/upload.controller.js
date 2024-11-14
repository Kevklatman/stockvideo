"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadController = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const crypto_1 = __importDefault(require("crypto"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Constants
const BUCKET_NAME = process.env.BUCKET_NAME;
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
const UPLOAD_URL_EXPIRATION = 3600; // 1 hour in seconds
// S3 Client initialization
const s3Client = new client_s3_1.S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});
class UploadController {
    static async getUploadUrl(req, res) {
        try {
            const { contentType, fileSize } = req.body;
            if (!contentType) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Content type is required'
                });
            }
            const videoId = crypto_1.default.randomUUID();
            const key = `videos/${videoId}`;
            // Create the command for S3
            const command = new client_s3_1.PutObjectCommand({
                Bucket: process.env.AWS_BUCKET_NAME, // Make sure this env var is set
                Key: key,
                ContentType: contentType,
                Metadata: {
                    uploadedAt: new Date().toISOString()
                }
            });
            const url = await (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, {
                expiresIn: 3600
            });
            // Return data in the expected format
            res.json({
                status: 'success',
                data: {
                    url,
                    videoId,
                    key
                }
            });
        }
        catch (error) {
            console.error('Upload URL generation error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to generate upload URL'
            });
        }
    }
    static async createVideoRecord(req, res) {
        try {
            const { videoId, key } = req.body;
            // Validate required fields
            if (!videoId || !key) {
                return res.status(400).json({
                    status: 'error',
                    message: 'VideoId and key are required'
                });
            }
            // Validate video ID format
            if (!this.isValidUUID(videoId)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid video ID format'
                });
            }
            // Validate key format
            if (!key.startsWith('videos/')) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid key format'
                });
            }
            // Here you would typically:
            // 1. Create a database record for the video
            // 2. Initialize processing status
            // 3. Return the created record
            return res.json({
                status: 'success',
                data: {
                    videoId,
                    key,
                    status: 'processing',
                    createdAt: new Date().toISOString(),
                    userId: req.user?.id // Assuming req.user exists from auth middleware
                }
            });
        }
        catch (error) {
            console.error('Create video record error:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to create video record',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
    static async finalizeUpload(req, res) {
        try {
            const { videoId, key, metadata } = req.body;
            // Validate required fields
            if (!videoId || !key) {
                return res.status(400).json({
                    status: 'error',
                    message: 'VideoId and key are required'
                });
            }
            // Validate metadata
            if (!metadata || typeof metadata !== 'object') {
                return res.status(400).json({
                    status: 'error',
                    message: 'Valid metadata object is required'
                });
            }
            // Validate video ID and key format
            if (!this.isValidUUID(videoId) || !key.startsWith('videos/')) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid videoId or key format'
                });
            }
            // Here you would typically:
            // 1. Verify the upload was successful in S3
            // 2. Update the video record in your database
            // 3. Trigger any post-upload processing
            // 4. Return the updated record
            return res.json({
                status: 'success',
                data: {
                    videoId,
                    key,
                    metadata,
                    status: 'processing',
                    updatedAt: new Date().toISOString()
                }
            });
        }
        catch (error) {
            console.error('Finalize upload error:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to finalize upload',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
    static isValidUUID(uuid) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }
}
exports.UploadController = UploadController;
