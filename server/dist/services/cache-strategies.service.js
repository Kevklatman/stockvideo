"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheStrategies = void 0;
// src/services/cache-strategies.service.ts
const cache_service_1 = require("./cache.service");
class CacheStrategies {
    static async getVideoCache(videoId) {
        const cacheKey = `video:${videoId}`;
        return this.cache.get(cacheKey);
    }
    static async setVideoCache(video) {
        const cacheKey = `video:${video.id}`;
        await this.cache.set(cacheKey, video, this.VIDEO_TTL);
        await this.cache.setHash(`video:${video.id}:stats`, {
            views: 0,
            likes: 0,
            downloads: 0
        });
    }
    static async invalidateVideoCache(videoId) {
        await this.cache.del(`video:${videoId}`, `video:${videoId}:stats`, `video:${videoId}:views`);
    }
    static async incrementVideoViews(videoId) {
        const key = `video:${videoId}:views`;
        return this.cache.increment(key);
    }
    static async getCachedSearch(query, filters) {
        const filterHash = JSON.stringify(filters);
        const cacheKey = `search:${query}:${filterHash}`;
        return this.cache.get(cacheKey);
    }
    static async setCachedSearch(query, filters, results) {
        const filterHash = JSON.stringify(filters);
        const cacheKey = `search:${query}:${filterHash}`;
        await this.cache.set(cacheKey, results, this.SEARCH_TTL);
    }
    static async trackUserActivity(userId, activity) {
        const key = `user:${userId}:activity`;
        const now = Date.now();
        await this.cache.setHash(key, {
            [activity]: now,
            lastActive: now
        });
    }
    static async getRateLimitInfo(userId, action) {
        const key = `ratelimit:${action}:${userId}`;
        return this.cache.getHash(key);
    }
    static async setRateLimit(userId, action, limit, windowSeconds) {
        const key = `ratelimit:${action}:${userId}`;
        const now = Date.now();
        await this.cache.setHash(key, {
            count: 1,
            resetAt: now + (windowSeconds * 1000)
        });
    }
    static async incrementRateLimit(userId, action) {
        const key = `ratelimit:${action}:${userId}`;
        const current = await this.cache.getHash(key);
        if (!current || Date.now() > current.resetAt) {
            return false;
        }
        await this.cache.setHash(key, {
            ...current,
            count: current.count + 1
        });
        return true;
    }
    static async lockResource(resourceType, resourceId, ttl = 30) {
        return this.cache.lock(`${resourceType}:${resourceId}`, ttl);
    }
    static async unlockResource(resourceType, resourceId, token) {
        return this.cache.unlock(`${resourceType}:${resourceId}`, token);
    }
    static async clearUserCache(userId) {
        await this.cache.clearPattern(`user:${userId}:*`);
    }
    static async cacheVideoStats(videoId, stats) {
        const key = `video:${videoId}:stats`;
        await this.cache.setHash(key, stats);
    }
    static async getVideoStats(videoId) {
        const key = `video:${videoId}:stats`;
        return this.cache.getHash(key);
    }
}
exports.CacheStrategies = CacheStrategies;
CacheStrategies.cache = cache_service_1.CacheService.getInstance();
CacheStrategies.VIDEO_TTL = 3600; // 1 hour
CacheStrategies.USER_TTL = 1800; // 30 minutes
CacheStrategies.SEARCH_TTL = 300; // 5 minutes
