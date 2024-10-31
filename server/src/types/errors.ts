// src/types/errors.ts
export class VideoProcessingError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'VideoProcessingError';
    }
  }
  
  export class VideoAccessError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'VideoAccessError';
    }
  }
  
  export class PaymentError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'PaymentError';
    }
  }
  
  export class AuthError extends Error {
    constructor(message: string, public code: string) {
      super(message);
      this.name = 'AuthError';
    }
  }
  
  export class ValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ValidationError';
    }
  }
  
  export class StorageError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'StorageError';
    }
  }

  export class VideoNotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'VideoNotFoundError'
    }
  }