import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionValidator } from '@saas/contracts';
import RedisDefault, { Redis } from 'ioredis';

const RedisClient = (RedisDefault as any).default || RedisDefault;

@Injectable()
export class RedisSessionValidatorAdapter implements SessionValidator, OnModuleDestroy {
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
