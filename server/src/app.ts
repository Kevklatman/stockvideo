// server/src/app.ts
import 'reflect-metadata';
import express from "express";
import dotenv from "dotenv";
import * as path from 'path';
import { AppDataSource } from "./config/database";
import { authRouter } from "./routes/auth.routes";
import { videoRouter } from "./routes/video.routes";
import { security } from "./config/security";
import { errorHandler } from "./middleware/error.middleware";
import { useContainer} from "routing-controllers";
import { Container } from "typedi";

// Load environment variables early
dotenv.config({ path: path.join(__dirname, '../.env') });

// Log environment variables to verify they're loaded
console.log('Environment loaded:', {
  aws: {
    region: process.env.AWS_REGION,
    bucket: process.env.AWS_BUCKET_NAME,
    hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
    hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY
  },
  server: {
    port: process.env.PORT,
    env: process.env.NODE_ENV
  }
});

// Initialize reflect-metadata
useContainer(Container);

const app = express();

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security middleware
app.use(security.helmet);
app.use(security.cors);
app.use(security.securityHeaders);
app.use(security.sanitizeRequest);

// Rate limiting
app.use('/api/auth', security.rateLimits.auth);
app.use('/api/videos/upload', security.rateLimits.upload);
app.use('/api', security.rateLimits.api);

// Trust proxy if behind reverse proxy
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Routes
app.use("/api/auth", authRouter);
app.use("/api/videos", videoRouter);

// Serve static files with security headers
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
}, express.static(path.join(__dirname, '../uploads')));

// Health check endpoint with rate limit
app.get('/health', security.rateLimits.api, (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date(),
    environment: process.env.NODE_ENV 
  });
});

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  errorHandler(err, req, res, next);
});

// Handle 404
app.use((_req, res) => {
  res.status(404).json({ 
    status: 'error',
    code: 'NOT_FOUND',
    message: 'Resource not found' 
  });
});

// Database connection and server start
AppDataSource.initialize()
  .then(() => {
    console.log("Database connected");
    
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => console.log("TypeORM initialization error: ", error));

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  AppDataSource.destroy()
    .then(() => {
      console.log('Database connection closed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error during shutdown:', err);
      process.exit(1);
    });
});

export default app;