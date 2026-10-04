import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
    IdempotencyPort,
    IdempotencyRecord,
    IdempotencyStatus,
    SaveIdempotencyParams,
} from '../../../../application/ports/out/idempotency.port';
import { PrismaClientOrTx, PrismaService } from '../prisma.service';

@Injectable()
export class PrismaIdempotencyAdapter implements IdempotencyPort {
    constructor(@Inject(PrismaService) private readonly client: PrismaClientOrTx) {}

    async get<T>(tenantId: string, key: string): Promise<IdempotencyRecord<T> | null> {
        const record = await this.client.inventoryIdempotencyKey.findFirst({
            where: {
                tenantId,
                key,
            },
        });

        if (!record) {
            return null;
        }

        // Si expiró el TTL, considerar nulo
        if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
            return null;
        }

        let status = IdempotencyStatus.STARTED;
        if (record.responseBody !== null && record.responseBody !== undefined) {
            status = IdempotencyStatus.COMPLETED;
        } else if (record.statusCode && record.statusCode >= 400) {
            status = IdempotencyStatus.FAILED;
        }

        return {
            key: record.key,
            tenantId: record.tenantId,
            operation: record.operation,
            status,
            response: record.responseBody as unknown as T,
            resourceId: record.resourceId ?? undefined,
            createdAt: record.createdAt,
        };
    }

    async save<T>(params: SaveIdempotencyParams<T>): Promise<void> {
        const expiresAt = params.ttlSeconds
            ? new Date(Date.now() + params.ttlSeconds * 1000)
            : null;

        await this.client.inventoryIdempotencyKey.upsert({
            where: {
                tenantId_key: {
                    tenantId: params.tenantId,
                    key: params.key,
                },
            },
            create: {
                tenantId: params.tenantId,
                key: params.key,
                operation: params.operation,
                requestHash: `sha256:${params.key}`,
                statusCode: 200,
                responseBody: params.response as unknown as Prisma.InputJsonValue,
                resourceId: params.resourceId && params.resourceId.length === 36 ? params.resourceId : null,
                expiresAt,
            },
            update: {
                statusCode: 200,
                responseBody: params.response as unknown as Prisma.InputJsonValue,
                resourceId: params.resourceId && params.resourceId.length === 36 ? params.resourceId : null,
                expiresAt,
            },
        });
    }

    async release(tenantId: string, key: string): Promise<void> {
        await this.client.inventoryIdempotencyKey.deleteMany({
            where: {
                tenantId,
                key,
            },
        });
    }
}
