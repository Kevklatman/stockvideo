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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUploadedFile = exports.handleUploadError = exports.videoUpload = void 0;
exports.isMulterFile = isMulterFile;
const multer_1 = __importStar(require("multer"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
// Configure multer storage
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, path_1.default.join(__dirname, '../../uploads/temp'));
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = (0, uuid_1.v4)();
        cb(null, `${uniqueSuffix}${path_1.default.extname(file.originalname)}`);
    }
});
// Configure multer upload settings
exports.videoUpload = (0, multer_1.default)({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
    },
    fileFilter: (_req, file, cb) => {
        const allowedMimes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Only MP4, MOV, and AVI formats are allowed.'));
        }
    }
});
// Error handler middleware with proper typing
const handleUploadError = (err, _req, res, _next) => {
    if (err instanceof multer_1.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            res.status(400).json({
                status: 'error',
                code: 'FILE_TOO_LARGE',
                message: 'File size should not exceed 100MB'
            });
            return;
        }
        res.status(400).json({
            status: 'error',
            code: 'UPLOAD_ERROR',
            message: err.message
        });
        return;
    }
    res.status(400).json({
        status: 'error',
        code: 'INVALID_FILE',
        message: err.message
    });
};
exports.handleUploadError = handleUploadError;
// Type guard for multer file
function isMulterFile(file) {
    return (file &&
        typeof file === 'object' &&
        'fieldname' in file &&
        'originalname' in file &&
        'mimetype' in file);
}
// Validate uploaded file middleware with proper typing
const validateUploadedFile = (req, res, next) => {
    if (!req.file) {
        res.status(400).json({
            status: 'error',
            code: 'NO_FILE',
            message: 'No file was uploaded'
        });
        return;
    }
    if (!isMulterFile(req.file)) {
        res.status(400).json({
            status: 'error',
            code: 'INVALID_FILE',
            message: 'Invalid file upload'
        });
        return;
    }
    next();
};
exports.validateUploadedFile = validateUploadedFile;
