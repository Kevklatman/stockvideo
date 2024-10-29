// src/config/cache.ts
import { CacheService } from '../services/cache.service';

const cacheConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  keyPrefix: 'stock-video:'
};

export const initCache = (): CacheService => {
  const cache = CacheService.getInstance(cacheConfig);

  cache.onError((error) => {
    console.error('Cache Error:', error);
    // Implement your error notification system here
  });

  cache.onConnect(() => {
    console.log('Cache Connected');
  });

  cache.onReady(() => {
    console.log('Cache Ready');
  });

  process.on('SIGTERM', async () => {
    await cache.quit();
  });

  return cache;
};