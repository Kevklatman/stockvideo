"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheService = void 0;
// src/services/cache.service.ts
const ioredis_1 = __importDefault(require("ioredis"));
const events_1 = require("events");
class CacheService {
    constructor(config) {
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.defaultTTL = 3600; // 1 hour
        this.eventEmitter = new events_1.EventEmitter();
        this.client = this.createClient(config);
        this.setupEventHandlers();
    }
    static getInstance(config) {
        if (!CacheService.instance) {
            if (!config) {
                throw new Error('Redis configuration required for initial setup');
            }
            CacheService.instance = new CacheService(config);
        }
        return CacheService.instance;
    }
    createClient(config) {
        return new ioredis_1.default({
            host: config.host,
            port: config.port,
            password: config.password,
            keyPrefix: config.keyPrefix,
            retryStrategy: (times) => {
                if (times > this.maxReconnectAttempts) {
                    return null; // Stop retrying
                }
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            autoResubscribe: true,
            autoResendUnfulfilledCommands: true,
            reconnectOnError: (err) => {
                const targetError = 'READONLY';
                if (err.message.includes(targetError)) {
                    return true; // Reconnect for READONLY error
                }
                return false;
            }
        });
    }
    setupEventHandlers() {
        this.client.on('error', (error) => {
            console.error('Redis Client Error:', error);
            this.eventEmitter.emit('error', error);
        });
        this.client.on('connect', () => {
            console.log('Redis Client Connected');
            this.reconnectAttempts = 0;
            this.eventEmitter.emit('connect');
        });
        this.client.on('ready', () => {
            console.log('Redis Client Ready');
            this.eventEmitter.emit('ready');
        });
        this.client.on('end', () => {
            console.log('Redis Client Connection Ended');
            this.eventEmitter.emit('end');
        });
        this.client.on('reconnecting', () => {
            this.reconnectAttempts++;
            console.log(`Redis Client Reconnecting... Attempt ${this.reconnectAttempts}`);
            this.eventEmitter.emit('reconnecting', this.reconnectAttempts);
        });
    }
    async get(key) {
        try {
            const data = await this.client.get(key);
            return data ? JSON.parse(data) : null;
        }
        catch (error) {
            console.error(`Cache get error for key ${key}:`, error);
            return null;
        }
    }
    async set(key, value, ttl) {
        try {
            const stringValue = JSON.stringify(value);
            if (ttl) {
                await this.client.setex(key, ttl, stringValue);
            }
            else {
                await this.client.setex(key, this.defaultTTL, stringValue);
            }
            return true;
        }
        catch (error) {
            console.error(`Cache set error for key ${key}:`, error);
            return false;
        }
    }
    async del(...keys) {
        try {
            await this.client.del(...keys);
            return true;
        }
        catch (error) {
            console.error(`Cache delete error for keys [${keys.join(', ')}]:`, error);
            return false;
        }
    }
    async remember(key, ttl, callback) {
        try {
            const cachedValue = await this.get(key);
            if (cachedValue) {
                return cachedValue;
            }
            const freshValue = await callback();
            await this.set(key, freshValue, ttl);
            return freshValue;
        }
        catch (error) {
            console.error(`Cache remember error for key ${key}:`, error);
            return null;
        }
    }
    async clearPattern(pattern) {
        try {
            let cursor = '0';
            do {
                const [newCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
                cursor = newCursor;
                if (keys.length) {
                    await this.del(...keys);
                }
            } while (cursor !== '0');
            return true;
        }
        catch (error) {
            console.error(`Cache clear pattern error for pattern ${pattern}:`, error);
            return false;
        }
    }
    async increment(key, value = 1) {
        try {
            const result = await this.client.incrby(key, value);
            return result;
        }
        catch (error) {
            console.error(`Cache increment error for key ${key}:`, error);
            return null;
        }
    }
    async decrement(key, value = 1) {
        try {
            const result = await this.client.decrby(key, value);
            return result;
        }
        catch (error) {
            console.error(`Cache decrement error for key ${key}:`, error);
            return null;
        }
    }
    async setHash(key, hash) {
        try {
            const serializedHash = Object.entries(hash).reduce((acc, [field, value]) => ({
                ...acc,
                [field]: JSON.stringify(value)
            }), {});
            await this.client.hmset(key, serializedHash);
            return true;
        }
        catch (error) {
            console.error(`Cache setHash error for key ${key}:`, error);
            return false;
        }
    }
    async getHash(key) {
        try {
            const hash = await this.client.hgetall(key);
            if (!hash || Object.keys(hash).length === 0) {
                return null;
            }
            return Object.entries(hash).reduce((acc, [field, value]) => ({
                ...acc,
                [field]: JSON.parse(value)
            }), {});
        }
        catch (error) {
            console.error(`Cache getHash error for key ${key}:`, error);
            return null;
        }
    }
    async lock(key, ttl, retry = 3, retryDelay = 200) {
        const token = Math.random().toString(36).substring(2);
        let attempts = 0;
        while (attempts < retry) {
            try {
                const acquired = await this.client.set(`lock:${key}`, token, 'NX', 'EX', ttl);
                if (acquired) {
                    return token;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                attempts++;
            }
            catch (error) {
                console.error(`Cache lock error for key ${key}:`, error);
                return null;
            }
        }
        return null;
    }
    async unlock(key, token) {
        try {
            const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
            const result = await this.client.eval(script, 1, `lock:${key}`, token);
            return result === 1;
        }
        catch (error) {
            console.error(`Cache unlock error for key ${key}:`, error);
            return false;
        }
    }
    async health() {
        try {
            await this.client.ping();
            return true;
        }
        catch {
            return false;
        }
    }
    onError(callback) {
        this.eventEmitter.on('error', callback);
    }
    onConnect(callback) {
        this.eventEmitter.on('connect', callback);
    }
    onReady(callback) {
        this.eventEmitter.on('ready', callback);
    }
    async quit() {
        await this.client.quit();
    }
}
exports.CacheService = CacheService;
