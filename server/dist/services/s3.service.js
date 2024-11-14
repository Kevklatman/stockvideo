"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.s3Service = exports.S3Service = void 0;
exports.handleUploadRequest = handleUploadRequest;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_presigned_post_1 = require("@aws-sdk/s3-presigned-post");
const cloudfront_signer_1 = require("@aws-sdk/cloudfront-signer");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class S3Service {
    constructor() {
        this.s3Client = new client_s3_1.S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
        });
        this.bucket = process.env.AWS_BUCKET_NAME;
        this.cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN;
        this.cloudFrontKeyPairId = process.env.CLOUDFRONT_KEY_PAIR_ID;
        this.cloudFrontPrivateKey = process.env.CLOUDFRONT_PRIVATE_KEY;
    }
    async getVideoStreamingUrl(videoId) {
        const streamPath = `/videos/${videoId}/processed/stream.m3u8`;
        const url = `https://${this.cloudFrontDomain}${streamPath}`;
        return (0, cloudfront_signer_1.getSignedUrl)({
            url,
            keyPairId: this.cloudFrontKeyPairId,
            privateKey: this.cloudFrontPrivateKey,
            dateLessThan: new Date(Date.now() + 3600 * 1000).toISOString() // 1 hour
        });
    }
    async getThumbnailUrl(videoId) {
        const thumbnailPath = `/videos/${videoId}/thumbnail.jpg`;
        const url = `https://${this.cloudFrontDomain}${thumbnailPath}`;
        return (0, cloudfront_signer_1.getSignedUrl)({
            url,
            keyPairId: this.cloudFrontKeyPairId,
            privateKey: this.cloudFrontPrivateKey,
            dateLessThan: new Date(Date.now() + 3600 * 1000).toISOString()
        });
    }
    async createPresignedPost(key, contentType, options) {
        return (0, s3_presigned_post_1.createPresignedPost)(this.s3Client, {
            Bucket: this.bucket,
            Key: key,
            Conditions: [
                ['content-length-range', 0, options.maxSize],
                ['eq', '$Content-Type', contentType],
            ],
            Fields: {
                'Content-Type': contentType,
            },
            Expires: 3600,
        });
    }
}
exports.S3Service = S3Service;
exports.s3Service = new S3Service();
// Express route handler
async function handleUploadRequest(req, res) {
    if (!req.user) {
        return res.status(401).json({
            status: 'error',
            code: 'UNAUTHORIZED',
            message: 'Invalid token'
        });
    }
    try {
        const { key, contentType, fileSize } = req.body;
        if (!key || !contentType || !fileSize) {
            return res.status(400).json({
                status: 'error',
                code: 'MISSING_FIELDS',
                message: 'Missing required fields: key, contentType, or fileSize',
            });
        }
        const MAX_FILE_SIZE = 100 * 1024 * 1024;
        if (fileSize > MAX_FILE_SIZE) {
            return res.status(400).json({
                status: 'error',
                code: 'FILE_TOO_LARGE',
                message: 'File size exceeds maximum limit of 100MB',
            });
        }
        const presignedPost = await exports.s3Service.createPresignedPost(key, contentType, {
            maxSize: MAX_FILE_SIZE,
        });
        const videoId = key.split('/').pop()?.split('.')[0];
        const streamingUrl = videoId ? await exports.s3Service.getVideoStreamingUrl(videoId) : null;
        return res.json({
            status: 'success',
            data: {
                ...presignedPost,
                streamingUrl,
            }
        });
    }
    catch (error) {
        console.error('Error generating upload URL:', error);
        return res.status(500).json({
            status: 'error',
            code: 'UPLOAD_URL_GENERATION_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
