import { 
    S3Client, 
    GetObjectCommand,
    HeadObjectCommand,
    CopyObjectCommand,
    DeleteObjectCommand,
    DeleteObjectsCommand,
    ListObjectsV2Command,
    S3ServiceException
  } from '@aws-sdk/client-s3';
  import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
  import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
  import { Upload } from '@aws-sdk/lib-storage';
  import { Readable, PassThrough } from 'stream';
  import { StorageError } from '../types/errors';
  import { Logger } from '../utils/logger';
  
  const STREAMING_URL_EXPIRY = 3600; // 1 hour
  const PRESIGNED_URL_EXPIRY = 3600; // 1 hour
  const DEFAULT_MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  const DEFAULT_EXPIRES_IN = 3600; // 1 hour
  
  interface S3UploadConfig {
    maxFileSize?: number;
    allowedTypes?: string[];
    expiresIn?: number;
  }
  
  interface PresignedPostResponse {
    url: string;
    fields: Record<string, string>;
  }
  
  export class S3Service {
    private static instance: S3Service;
    private readonly s3Client: S3Client;
    private readonly bucket: string;
    private readonly logger: Logger;
    private initialized: boolean = false;
  
    private constructor() {
      this.logger = Logger.getInstance();
      
      // Validate environment variables
      const requiredEnvVars = this.validateEnvironmentVariables();
  
      try {
        this.s3Client = new S3Client({
          credentials: {
            accessKeyId: requiredEnvVars.AWS_ACCESS_KEY_ID,
            secretAccessKey: requiredEnvVars.AWS_SECRET_ACCESS_KEY
          },
          region: requiredEnvVars.AWS_REGION,
          maxAttempts: 3
        });
  
        this.bucket = requiredEnvVars.AWS_BUCKET_NAME;
        this.logger.info('S3Client created successfully');
      } catch (error) {
        const message = 'Failed to initialize S3 client';
        this.logger.error(message, error);
        throw new StorageError(message);
      }
    }
  
    private validateEnvironmentVariables() {
      const requiredEnvVars = {
        AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
        AWS_REGION: process.env.AWS_REGION,
        AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME
      };
  
      const missingVars = Object.entries(requiredEnvVars)
        .filter(([_, value]) => !value)
        .map(([key]) => key);
  
      if (missingVars.length > 0) {
        const error = `Missing required AWS configuration: ${missingVars.join(', ')}`;
        this.logger.error(error);
        throw new StorageError(error);
      }
  
      return requiredEnvVars as Record<keyof typeof requiredEnvVars, string>;
    }
  
    static getInstance(): S3Service {
      if (!S3Service.instance) {
        S3Service.instance = new S3Service();
      }
      return S3Service.instance;
    }
  
    async initialize(): Promise<void> {
      if (this.initialized) {
        return;
      }
  
      try {
        // Test connection by checking bucket existence
        await this.s3Client.send(new HeadObjectCommand({
          Bucket: this.bucket,
          Key: 'test-connection'
        }));
        this.initialized = true;
        this.logger.info('S3 service initialized successfully');
      } catch (error) {
        if (error instanceof S3ServiceException && error.name === 'NotFound') {
          // Bucket exists but object doesn't - this is fine
          this.initialized = true;
          this.logger.info('S3 service initialized successfully');
          return;
        }
        const message = 'Failed to initialize S3 service';
        this.logger.error(message, error);
        throw new StorageError(message);
      }
    }
  
    private ensureInitialized(): void {
      if (!this.initialized) {
        throw new StorageError('S3 service not initialized');
      }
    }
  
    private handleError(error: unknown, operation: string, details?: string): never {
      const message = `Failed to ${operation}${details ? `: ${details}` : ''}`;
      this.logger.error(message, error);
      
      if (error instanceof S3ServiceException) {
        throw new StorageError(`${message} - ${error.name}: ${error.message}`);
      }
      
      throw new StorageError(
        `${message}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  
    async getVideoStream(key: string): Promise<Readable> {
      this.ensureInitialized();
      try {
        const command = new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        });
  
        const response = await this.s3Client.send(command);
        
        if (!response.Body) {
          throw new StorageError('No body returned from S3');
        }
  
        return response.Body as Readable;
      } catch (error) {
        this.handleError(error, 'get video stream', key);
      }
    }
  
    async createPresignedPost(
      key: string,
      contentType: string,
      config: S3UploadConfig = {}
    ): Promise<PresignedPostResponse> {
      this.ensureInitialized();
      try {
        const { url, fields } = await createPresignedPost(this.s3Client, {
          Bucket: this.bucket,
          Key: key,
          Conditions: [
            ["content-length-range", 0, config.maxFileSize || DEFAULT_MAX_FILE_SIZE],
            ["starts-with", "$Content-Type", contentType],
          ],
          Expires: config.expiresIn || DEFAULT_EXPIRES_IN,
        });
  
        return { url, fields };
      } catch (error) {
        this.handleError(error, 'create presigned post', key);
      }
    }
  
    async getVideoStreamingUrl(
      key: string,
      expiresIn: number = STREAMING_URL_EXPIRY
    ): Promise<string> {
      this.ensureInitialized();
      try {
        const command = new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ResponseContentType: 'video/mp4',
        });
  
        return await getSignedUrl(this.s3Client, command, { expiresIn });
      } catch (error) {
        this.handleError(error, 'generate streaming URL', key);
      }
    }
  
    async uploadStream(
      key: string,
      stream: PassThrough,
      contentType: string
    ): Promise<void> {
      this.ensureInitialized();
      try {
        const upload = new Upload({
          client: this.s3Client,
          params: {
            Bucket: this.bucket,
            Key: key,
            Body: stream,
            ContentType: contentType
          },
          queueSize: 4, // number of concurrent parts uploaded
          partSize: 5 * 1024 * 1024 // 5MB part size
        });
  
        await upload.done();
      } catch (error) {
        this.handleError(error, 'upload stream', key);
      }
    }
  
    async listObjects(prefix: string): Promise<string[]> {
      this.ensureInitialized();
      try {
        const command = new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix
        });
    
        const objects: string[] = [];
        let isTruncated = true;
        let continuationToken: string | undefined;
    
        while (isTruncated) {
          const response = await this.s3Client.send(command);
          
          if (response.Contents) {
            objects.push(...response.Contents.map(obj => obj.Key!));
          }
    
          isTruncated = response.IsTruncated || false;
          continuationToken = response.NextContinuationToken;
          
          if (isTruncated && continuationToken) {
            command.input.ContinuationToken = continuationToken;
          }
        }
    
        return objects;
      } catch (error) {
        this.handleError(error, 'list objects', prefix);
      }
    }
  
    async copyObject(sourceKey: string, destinationKey: string): Promise<void> {
      this.ensureInitialized();
      try {
        const command = new CopyObjectCommand({
          Bucket: this.bucket,
          CopySource: `${this.bucket}/${sourceKey}`,
          Key: destinationKey,
        });
  
        await this.s3Client.send(command);
      } catch (error) {
        this.handleError(error, 'copy object', `${sourceKey} to ${destinationKey}`);
      }
    }
  
    async moveObject(sourceKey: string, destinationKey: string): Promise<void> {
      this.ensureInitialized();
      try {
        await this.copyObject(sourceKey, destinationKey);
        await this.deleteObject(sourceKey);
      } catch (error) {
        this.handleError(error, 'move object', `${sourceKey} to ${destinationKey}`);
      }
    }
  
    async deleteObject(key: string): Promise<void> {
      this.ensureInitialized();
      try {
        const command = new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        });
  
        await this.s3Client.send(command);
      } catch (error) {
        this.handleError(error, 'delete object', key);
      }
    }
  
    async deleteObjects(keys: string[]): Promise<void> {
      this.ensureInitialized();
      try {
        const command = new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: {
            Objects: keys.map(key => ({ Key: key })),
            Quiet: true
          }
        });
  
        await this.s3Client.send(command);
      } catch (error) {
        this.handleError(error, 'delete objects', keys.join(', '));
      }
    }
  
    async validateObjectExists(key: string): Promise<boolean> {
      this.ensureInitialized();
      try {
        const command = new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        });
  
        await this.s3Client.send(command);
        return true;
      } catch (error) {
        if (error instanceof S3ServiceException && error.name === 'NotFound') {
          return false;
        }
        this.handleError(error, 'validate object exists', key);
      }
    }
  
    async getObjectSize(key: string): Promise<number> {
      this.ensureInitialized();
      try {
        const command = new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        });
  
        const response = await this.s3Client.send(command);
        
        if (!response.ContentLength) {
          throw new StorageError('Content length not available');
        }
  
        return response.ContentLength;
      } catch (error) {
        this.handleError(error, 'get object size', key);
      }
    }
  
    async checkConnection(): Promise<boolean> {
      try {
        await this.initialize();
        return true;
      } catch (error) {
        this.logger.error('Connection check failed:', error);
        return false;
      }
    }
  
    getBucketName(): string {
      this.ensureInitialized();
      return this.bucket;
    }
  }
  
  // Initialize logger for singleton creation
  const logger = Logger.getInstance();
  
  // Create and export singleton instance
  let s3ServiceInstance: S3Service;
  
  try {
    s3ServiceInstance = S3Service.getInstance();
    logger.info('S3Service instance created successfully');
  } catch (error) {
    logger.error('Failed to create S3Service instance:', error);
    throw error;
  }
  
  export const s3Service = s3ServiceInstance;