import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionCache, SessionValidator } from '@saas/contracts';
import RedisDefault, { Redis } from 'ioredis';

const RedisClient = (RedisDefault as any).default || RedisDefault;

@Injectable()
export class RedisSessionValidatorAdapter implements SessionValidator, SessionCache, OnModuleDestroy {
    private readonly logger = new Logger(RedisSessionValidatorAdapter.name);
    private readonly redisClient: Redis;

    constructor(private readonly configService: ConfigService) {
        const redisUrl =
            this.configService.get<string>('REDIS_URL') ||
            process.env.REDIS_URL ||
            'redis://localhost:6379';

        this.redisClient = new RedisClient(redisUrl, {
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            enableOfflineQueue: false,
            retryStrategy: () => null, // Don't hang indefinitely on connection failure
        });

        this.redisClient.on('error', (err) => {
            this.logger.warn(`Redis connection warning: ${err.message}`);
        });
    }

    async isSessionActive(userId: string, sessionId: string): Promise<boolean> {
        try {
            if (this.redisClient.status !== 'ready') {
                await this.redisClient.connect().catch(() => {
                    // Suppress connection failure if Redis is unavailable in environment
                });
            }

            const session = await this.redisClient.get(`session:${userId}:${sessionId}`);
            return session === 'active';
        } catch (error: any) {
            this.logger.warn(
                `No se pudo verificar la sesión en Redis para user=${userId}, session=${sessionId}: ${error.message}`,
            );
            // Si Redis no está disponible o falla, denegar sesión por principio de seguridad
            return false;
        }
    }

    async saveSession(userId: string, sessionId: string, ttl: number): Promise<void> {
        try {
            if (this.redisClient.status !== 'ready') {
                await this.redisClient.connect().catch(() => {});
            }
            await this.redisClient.set(`session:${userId}:${sessionId}`, 'active', 'EX', ttl);
        } catch (error: any) {
            this.logger.error(`Error al guardar sesión en Redis para user=${userId}: ${error.message}`);
            throw error;
        }
    }

    async invalidateSession(userId: string, sessionId: string): Promise<void> {
        try {
            if (this.redisClient.status !== 'ready') {
                await this.redisClient.connect().catch(() => {});
            }
            await this.redisClient.del(`session:${userId}:${sessionId}`);
        } catch (error: any) {
            this.logger.error(`Error al invalidar sesión en Redis para user=${userId}: ${error.message}`);
            throw error;
        }
    }

    async invalidateUserSessions(userId: string): Promise<void> {
        try {
            if (this.redisClient.status !== 'ready') {
                await this.redisClient.connect().catch(() => {});
            }
            const keys = await this.redisClient.keys(`session:${userId}:*`);
            if (keys.length > 0) {
                await this.redisClient.del(...keys);
            }
        } catch (error: any) {
            this.logger.error(`Error al invalidar todas las sesiones en Redis para user=${userId}: ${error.message}`);
            throw error;
        }
    }

    async onModuleDestroy(): Promise<void> {
        try {
            if (this.redisClient.status === 'ready') {
                await this.redisClient.quit();
            }
        } catch {
            this.redisClient.disconnect();
        }
    }
}
