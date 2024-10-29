// src/services/cache-strategies.service.ts
import { CacheService } from './cache.service';
import { Video } from '../models/video.model';
import { User } from '../models/user.model';

export class CacheStrategies {
  private static readonly cache = CacheService.getInstance();
  private static readonly VIDEO_TTL = 3600; // 1 hour
  private static readonly USER_TTL = 1800; // 30 minutes
  private static readonly SEARCH_TTL = 300; // 5 minutes

  static async getVideoCache(videoId: string): Promise<Video | null> {
    const cacheKey = `video:${videoId}`;
    return this.cache.get<Video>(cacheKey);
  }

  static async setVideoCache(video: Video): Promise<void> {
      const cacheKey = `video:${video.id}`;
      await this.cache.set(cacheKey, video, this.VIDEO_TTL);
      await this.cache.setHash(`video:${video.id}:stats`, {
        views: 0,
        likes: 0,
        downloads: 0
      });
    }

  static async invalidateVideoCache(videoId: string): Promise<void> {
    await this.cache.del(
      `video:${videoId}`,
      `video:${videoId}:stats`,
      `video:${videoId}:views`
    );
  }

  static async incrementVideoViews(videoId: string): Promise<number | null> {
    const key = `video:${videoId}:views`;
    return this.cache.increment(key);
  }

  static async getCachedSearch(query: string, filters: any): Promise<any | null> {
    const filterHash = JSON.stringify(filters);
    const cacheKey = `search:${query}:${filterHash}`;
    return this.cache.get(cacheKey);
  }

  static async setCachedSearch(
    query: string,
    filters: any,
    results: any
  ): Promise<void> {
    const filterHash = JSON.stringify(filters);
    const cacheKey = `search:${query}:${filterHash}`;
    await this.cache.set(cacheKey, results, this.SEARCH_TTL);
  }

  static async trackUserActivity(
    userId: string,
    activity: 'view' | 'download' | 'purchase'
  ): Promise<void> {
    const key = `user:${userId}:activity`;
    const now = Date.now();
    await this.cache.setHash(key, {
      [activity]: now,
      lastActive: now
    });
  }

  static async getRateLimitInfo(
    userId: string,
    action: string
  ): Promise<{ count: number; resetAt: number } | null> {
    const key = `ratelimit:${action}:${userId}`;
    return this.cache.getHash(key);
  }

  static async setRateLimit(
    userId: string,
    action: string,
    limit: number,
    windowSeconds: number
  ): Promise<void> {
    const key = `ratelimit:${action}:${userId}`;
    const now = Date.now();
    await this.cache.setHash(key, {
      count: 1,
      resetAt: now + (windowSeconds * 1000)
    });
  }

  static async incrementRateLimit(
    userId: string,
    action: string
  ): Promise<boolean> {
    const key = `ratelimit:${action}:${userId}`;
    const current = await this.cache.getHash<{ count: number; resetAt: number }>(key);
    
    if (!current || Date.now() > current.resetAt) {
      return false;
    }

    await this.cache.setHash(key, {
      ...current,
      count: current.count + 1
    });
    return true;
  }

  static async lockResource(
    resourceType: string,
    resourceId: string,
    ttl: number = 30
  ): Promise<string | null> {
    return this.cache.lock(`${resourceType}:${resourceId}`, ttl);
  }

  static async unlockResource(
    resourceType: string,
    resourceId: string,
    token: string
  ): Promise<boolean> {
    return this.cache.unlock(`${resourceType}:${resourceId}`, token);
  }

  static async clearUserCache(userId: string): Promise<void> {
    await this.cache.clearPattern(`user:${userId}:*`);
  }

  static async cacheVideoStats(videoId: string, stats: any): Promise<void> {
    const key = `video:${videoId}:stats`;
    await this.cache.setHash(key, stats);
  }

  static async getVideoStats(videoId: string): Promise<any | null> {
    const key = `video:${videoId}:stats`;
    return this.cache.getHash(key);
  }
}