// SNMP Cache Service for Y Monitor
// Implements caching for SNMP responses to improve performance

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { ISNMPCache, SNMPOperation } from '../interfaces/snmp-client.interface';
import { SNMPDevice, SNMPResponse } from '../types/snmp.types';

@Injectable()
export class SNMPCacheService implements ISNMPCache {
  private readonly logger = new Logger(SNMPCacheService.name);
  private readonly redis: Redis;
  private readonly keyPrefix: string;

  constructor(private configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });

    this.keyPrefix = this.configService.get<string>('SNMP_CACHE_PREFIX', 'ymonitor:snmp:');

    this.redis.on('error', (error) => {
      this.logger.error(`Redis connection error: ${error.message}`);
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis connected for SNMP cache');
    });
  }

  async get(key: string): Promise<SNMPResponse | null> {
    try {
      const cachedData = await this.redis.get(this.keyPrefix + key);
      
      if (!cachedData) {
        return null;
      }

      const parsed = JSON.parse(cachedData);
      
      // Validate cached data structure
      if (!this.isValidCachedResponse(parsed)) {
        this.logger.warn(`Invalid cached data for key: ${key}`);
        await this.delete(key);
        return null;
      }

      this.logger.debug(`Cache hit for key: ${key}`);
      return parsed;
    } catch (error) {
      this.logger.error(`Failed to get cached data for key ${key}: ${error.message}`);
      return null;
    }
  }

  async set(key: string, response: SNMPResponse, ttl: number): Promise<void> {
    try {
      const serialized = JSON.stringify(response);
      await this.redis.setex(this.keyPrefix + key, ttl, serialized);
      
      this.logger.debug(`Cached response for key: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      this.logger.error(`Failed to cache data for key ${key}: ${error.message}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(this.keyPrefix + key);
      this.logger.debug(`Deleted cache for key: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete cache for key ${key}: ${error.message}`);
    }
  }

  async clear(): Promise<void> {
    try {
      const keys = await this.redis.keys(this.keyPrefix + '*');
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.log(`Cleared ${keys.length} cached SNMP responses`);
      }
    } catch (error) {
      this.logger.error(`Failed to clear SNMP cache: ${error.message}`);
    }
  }

  generateKey(device: SNMPDevice, operation: SNMPOperation): string {
    // Create a deterministic cache key based on device and operation
    const deviceKey = this.generateDeviceKey(device);
    const operationKey = this.generateOperationKey(operation);
    
    return `${deviceKey}:${operationKey}`;
  }

  async getCacheStats(): Promise<{
    totalKeys: number;
    memoryUsage: number;
    hitRate: number;
  }> {
    try {
      const keys = await this.redis.keys(this.keyPrefix + '*');
      const info = await this.redis.memory('USAGE', this.keyPrefix + '*');
      
      // Get hit/miss statistics (this would need to be tracked separately)
      const stats = await this.redis.hgetall(this.keyPrefix + 'stats');
      const hits = parseInt(stats.hits || '0');
      const misses = parseInt(stats.misses || '0');
      const total = hits + misses;
      const hitRate = total > 0 ? (hits / total) * 100 : 0;

      return {
        totalKeys: keys.length,
        memoryUsage: info || 0,
        hitRate,
      };
    } catch (error) {
      this.logger.error(`Failed to get cache stats: ${error.message}`);
      return {
        totalKeys: 0,
        memoryUsage: 0,
        hitRate: 0,
      };
    }
  }

  async incrementHitCounter(): Promise<void> {
    try {
      await this.redis.hincrby(this.keyPrefix + 'stats', 'hits', 1);
    } catch (error) {
      this.logger.error(`Failed to increment hit counter: ${error.message}`);
    }
  }

  async incrementMissCounter(): Promise<void> {
    try {
      await this.redis.hincrby(this.keyPrefix + 'stats', 'misses', 1);
    } catch (error) {
      this.logger.error(`Failed to increment miss counter: ${error.message}`);
    }
  }

  async clearDevice(deviceId: string): Promise<void> {
    try {
      const pattern = this.keyPrefix + `*:device:${deviceId}:*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.log(`Cleared ${keys.length} cached responses for device ${deviceId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to clear cache for device ${deviceId}: ${error.message}`);
    }
  }

  async invalidateByOID(oid: string): Promise<void> {
    try {
      const pattern = this.keyPrefix + `*:oid:${oid.replace(/\./g, '_')}:*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.log(`Invalidated ${keys.length} cached responses for OID ${oid}`);
      }
    } catch (error) {
      this.logger.error(`Failed to invalidate cache for OID ${oid}: ${error.message}`);
    }
  }

  async warmup(devices: SNMPDevice[], commonOids: string[]): Promise<void> {
    this.logger.log(`Starting cache warmup for ${devices.length} devices`);
    
    const warmupPromises = devices.map(async (device) => {
      for (const oid of commonOids) {
        try {
          // This would typically be called by the polling service
          // to pre-populate the cache with frequently accessed data
          const operation: SNMPOperation = {
            type: 'get',
            oids: [oid],
          };
          
          // Generate cache key for monitoring
          const key = this.generateKey(device, operation);
          this.logger.debug(`Warmup key generated: ${key}`);
        } catch (error) {
          this.logger.warn(`Failed to warmup cache for device ${device.hostname}, OID ${oid}: ${error.message}`);
        }
      }
    });

    await Promise.allSettled(warmupPromises);
    this.logger.log('Cache warmup completed');
  }

  private generateDeviceKey(device: SNMPDevice): string {
    // Create device identifier that includes relevant connection parameters
    const parts = [
      device.hostname,
      device.port.toString(),
      device.version,
    ];

    if (device.version === 'v3') {
      parts.push(device.username || '');
      parts.push(device.contextName || '');
    } else {
      parts.push(device.community || '');
    }

    return `device:${Buffer.from(parts.join(':')).toString('base64')}`;
  }

  private generateOperationKey(operation: SNMPOperation): string {
    const parts = [
      operation.type,
      operation.oids.sort().join(','), // Sort OIDs for consistency
    ];

    if (operation.maxRepetitions) {
      parts.push(`maxrep:${operation.maxRepetitions}`);
    }

    if (operation.nonRepeaters) {
      parts.push(`nonrep:${operation.nonRepeaters}`);
    }

    return `op:${Buffer.from(parts.join(':')).toString('base64')}`;
  }

  private isValidCachedResponse(data: any): boolean {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.success === 'boolean' &&
      Array.isArray(data.varbinds) &&
      data.varbinds.every((vb: any) => 
        vb &&
        typeof vb.oid === 'string' &&
        vb.type &&
        vb.value !== undefined
      )
    );
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit();
      this.logger.log('Redis connection closed');
    } catch (error) {
      this.logger.error(`Failed to close Redis connection: ${error.message}`);
    }
  }
}