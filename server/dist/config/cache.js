"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initCache = void 0;
// src/config/cache.ts
const cache_service_1 = require("../services/cache.service");
const cacheConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    keyPrefix: 'stock-video:'
};
const initCache = () => {
    const cache = cache_service_1.CacheService.getInstance(cacheConfig);
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
exports.initCache = initCache;
