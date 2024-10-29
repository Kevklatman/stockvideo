// src/services/cache.service.ts
import Redis from 'ioredis';
import { RedisConfig, CacheConfig } from '../types';
import { EventEmitter } from 'events';

export class CacheService {
  private static instance: CacheService;
  private client: Redis;
  private readonly eventEmitter: EventEmitter;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 10;
  private readonly defaultTTL: number = 3600; // 1 hour

  private constructor(config: RedisConfig) {
    this.eventEmitter = new EventEmitter();
    this.client = this.createClient(config);
    this.setupEventHandlers();
  }

  static getInstance(config?: RedisConfig): CacheService {
    if (!CacheService.instance) {
      if (!config) {
        throw new Error('Redis configuration required for initial setup');
      }
      CacheService.instance = new CacheService(config);
    }
    return CacheService.instance;
  }

  private createClient(config: RedisConfig): Redis {
    return new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      keyPrefix: config.keyPrefix,
      retryStrategy: (times: number) => {
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
      reconnectOnError: (err: Error) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true; // Reconnect for READONLY error
        }
        return false;
      }
    });
  }

  private setupEventHandlers(): void {
    this.client.on('error', (error: Error) => {
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

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      const stringValue = JSON.stringify(value);
      if (ttl) {
        await this.client.setex(key, ttl, stringValue);
      } else {
        await this.client.setex(key, this.defaultTTL, stringValue);
      }
      return true;
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  async del(...keys: string[]): Promise<boolean> {
    try {
      await this.client.del(...keys);
      return true;
    } catch (error) {
      console.error(`Cache delete error for keys [${keys.join(', ')}]:`, error);
      return false;
    }
  }

  async remember<T>(
    key: string,
    ttl: number,
    callback: () => Promise<T>
  ): Promise<T | null> {
    try {
      const cachedValue = await this.get<T>(key);
      if (cachedValue) {
        return cachedValue;
      }

      const freshValue = await callback();
      await this.set(key, freshValue, ttl);
      return freshValue;
    } catch (error) {
      console.error(`Cache remember error for key ${key}:`, error);
      return null;
    }
  }

  async clearPattern(pattern: string): Promise<boolean> {
    try {
      let cursor = '0';
      do {
        const [newCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        cursor = newCursor;

        if (keys.length) {
          await this.del(...keys);
        }
      } while (cursor !== '0');

      return true;
    } catch (error) {
      console.error(`Cache clear pattern error for pattern ${pattern}:`, error);
      return false;
    }
  }

  async increment(key: string, value: number = 1): Promise<number | null> {
    try {
      const result = await this.client.incrby(key, value);
      return result;
    } catch (error) {
      console.error(`Cache increment error for key ${key}:`, error);
      return null;
    }
  }

  async decrement(key: string, value: number = 1): Promise<number | null> {
    try {
      const result = await this.client.decrby(key, value);
      return result;
    } catch (error) {
      console.error(`Cache decrement error for key ${key}:`, error);
      return null;
    }
  }

  async setHash(key: string, hash: Record<string, any>): Promise<boolean> {
    try {
      const serializedHash = Object.entries(hash).reduce(
        (acc, [field, value]) => ({
          ...acc,
          [field]: JSON.stringify(value)
        }),
        {}
      );
      await this.client.hmset(key, serializedHash);
      return true;
    } catch (error) {
      console.error(`Cache setHash error for key ${key}:`, error);
      return false;
    }
  }

  async getHash<T = Record<string, any>>(key: string): Promise<T | null> {
    try {
      const hash = await this.client.hgetall(key);
      if (!hash || Object.keys(hash).length === 0) {
        return null;
      }

      return Object.entries(hash).reduce(
        (acc, [field, value]) => ({
          ...acc,
          [field]: JSON.parse(value as string)
        }),
        {}
      ) as T;
    } catch (error) {
      console.error(`Cache getHash error for key ${key}:`, error);
      return null;
    }
  }

  async lock(
    key: string,
    ttl: number,
    retry: number = 3,
    retryDelay: number = 200
  ): Promise<string | null> {
    const token = Math.random().toString(36).substring(2);
    let attempts = 0;

    while (attempts < retry) {
      try {
        const acquired = await this.client.set(
          `lock:${key}`,
          token,
          'NX',
          'EX',
          ttl
        );

        if (acquired) {
          return token;
        }

        await new Promise(resolve => setTimeout(resolve, retryDelay));
        attempts++;
      } catch (error) {
        console.error(`Cache lock error for key ${key}:`, error);
        return null;
      }
    }

    return null;
  }

  async unlock(key: string, token: string): Promise<boolean> {
    try {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = await this.client.eval(
        script,
        1,
        `lock:${key}`,
        token
      );

      return result === 1;
    } catch (error) {
      console.error(`Cache unlock error for key ${key}:`, error);
      return false;
    }
  }

  async health(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  onError(callback: (error: Error) => void): void {
    this.eventEmitter.on('error', callback);
  }

  onConnect(callback: () => void): void {
    this.eventEmitter.on('connect', callback);
  }

  onReady(callback: () => void): void {
    this.eventEmitter.on('ready', callback);
  }

  async quit(): Promise<void> {
    await this.client.quit();
  }
}