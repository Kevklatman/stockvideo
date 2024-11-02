// src/middleware/video-upload.middleware.ts
import { Request, Response, NextFunction } from 'express';
import multer, { MulterError } from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Configure multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/temp'));
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = uuidv4();
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// Configure multer upload settings
export const videoUpload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP4, MOV, and AVI formats are allowed.'));
    }
  }
});

// Error handler middleware with proper typing
export const handleUploadError = (
  err: MulterError | Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof MulterError) {
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

// Type guard for multer file
export function isMulterFile(file: any): file is Express.Multer.File {
  return (
    file &&
    typeof file === 'object' &&
    'fieldname' in file &&
    'originalname' in file &&
    'mimetype' in file
  );
}

// Validate uploaded file middleware with proper typing
export const validateUploadedFile = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
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