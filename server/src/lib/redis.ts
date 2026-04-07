import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';

export class RedisService {
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;
  private memoryCache: Map<string, { value: string; expiry: number }> = new Map();

  constructor() {
    this.connect();
  }

  private async connect() {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      logger.warn('REDIS_URL not set, using in-memory cache');
      return;
    }

    try {
      this.client = createClient({ url: redisUrl });
      
      this.client.on('error', (err: unknown) => {
        logger.error('Redis Client Error', err);
        this.isConnected = false;
      });
      
      this.client.on('connect', () => {
        logger.info('Redis connected');
        this.isConnected = true;
      });
      
      this.client.on('disconnect', () => {
        logger.warn('Redis disconnected');
        this.isConnected = false;
      });
      
      await this.client.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis', error);
      this.isConnected = false;
    }
  }

  async ping(): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  async get(key: string): Promise<string | null> {
    // Try Redis first
    if (this.client && this.isConnected) {
      try {
        return await this.client.get(key);
      } catch (error) {
        logger.error('Redis GET error', error);
      }
    }
    
    // Fallback to memory cache
    const cached = this.memoryCache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }
    this.memoryCache.delete(key);
    return null;
  }

  async set(key: string, value: string, ttlSeconds: number = 3600): Promise<void> {
    // Try Redis first
    if (this.client && this.isConnected) {
      try {
        await this.client.setEx(key, ttlSeconds, value);
        return;
      } catch (error) {
        logger.error('Redis SET error', error);
      }
    }
    
    // Fallback to memory cache
    this.memoryCache.set(key, {
      value,
      expiry: Date.now() + (ttlSeconds * 1000)
    });
  }

  async del(key: string): Promise<void> {
    if (this.client && this.isConnected) {
      try {
        await this.client.del(key);
      } catch (error) {
        logger.error('Redis DEL error', error);
      }
    }
    this.memoryCache.delete(key);
  }

  async setUserOnline(userId: string, online: boolean): Promise<void> {
    const key = `user:online:${userId}`;
    if (online) {
      await this.set(key, 'true', 300); // 5 minutes
    } else {
      await this.del(key);
    }
  }

  async isUserOnline(userId: string): Promise<boolean> {
    const result = await this.get(`user:online:${userId}`);
    return result === 'true';
  }

  async cacheFreelancers(data: any, ttl: number = 300): Promise<void> {
    await this.set('freelancers:all', JSON.stringify(data), ttl);
  }

  async getCachedFreelancers(): Promise<any | null> {
    const cached = await this.get('freelancers:all');
    return cached ? JSON.parse(cached) : null;
  }

  async invalidateFreelancerCache(): Promise<void> {
    await this.del('freelancers:all');
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
    }
  }
}
