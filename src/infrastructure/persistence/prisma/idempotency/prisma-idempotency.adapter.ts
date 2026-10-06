import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
    AcquireIdempotencyParams,
    AcquireIdempotencyResult,
    IdempotencyPort,
    IdempotencyRecord,
    IdempotencyStatus,
    SaveIdempotencyParams,
} from '../../../../application/ports/out/idempotency.port';
import { IdempotencyConflictException } from '../../../../application/exceptions/idempotency-conflict.exception';
import { PrismaClientOrTx, PrismaService } from '../prisma.service';

const DEFAULT_STARTED_LOCK_TIMEOUT_SECONDS = 60;

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

    async acquire<T>(params: AcquireIdempotencyParams): Promise<AcquireIdempotencyResult<T>> {
        const existing = await this.client.inventoryIdempotencyKey.findFirst({
            where: {
                tenantId: params.tenantId,
                key: params.key,
            },
        });

        if (existing) {
            // Si ya expiró su TTL total, eliminamos y permitimos nueva adquisición
            if (existing.expiresAt && existing.expiresAt.getTime() < Date.now()) {
                await this.client.inventoryIdempotencyKey.deleteMany({
                    where: { id: existing.id },
                });
            } else if (existing.responseBody !== null && existing.responseBody !== undefined) {
                // Ya completado exitosamente: retornar el resultado previo
                return {
                    acquired: false,
                    completed: true,
                    response: existing.responseBody as unknown as T,
                };
            } else {
                // Estado STARTED (en progreso)
                const ageSeconds = (Date.now() - existing.createdAt.getTime()) / 1000;
                const timeoutSeconds = params.ttlSeconds ?? DEFAULT_STARTED_LOCK_TIMEOUT_SECONDS;
                if (ageSeconds < timeoutSeconds) {
                    throw new IdempotencyConflictException(
                        params.key,
                        params.operation,
                        `Conflicto de idempotencia: la operación '${params.operation}' ya está en progreso para la clave '${params.key}'`,
                    );
                }

                // Superó el timeout de STARTED: proceso anterior considerado huérfano. Reclamar lock.
                await this.client.inventoryIdempotencyKey.update({
                    where: { id: existing.id },
                    data: {
                        operation: params.operation,
                        requestHash: params.requestHash ?? `sha256:${params.key}`,
                        createdAt: new Date(),
                        statusCode: null,
                        responseBody: Prisma.DbNull,
                    },
                });

                return {
                    acquired: true,
                    completed: false,
                };
            }
        }

        // Intento atómico de inserción: si dos hilos compiten, el índice único (tenant_id, key) rechaza al segundo con P2002
        try {
            await this.client.inventoryIdempotencyKey.create({
                data: {
                    tenantId: params.tenantId,
                    key: params.key,
                    operation: params.operation,
                    requestHash: params.requestHash ?? `sha256:${params.key}`,
                    statusCode: null,
                    responseBody: Prisma.DbNull,
                    createdAt: new Date(),
                    expiresAt: params.ttlSeconds
                        ? new Date(Date.now() + params.ttlSeconds * 1000)
                        : null,
                },
            });

            return {
                acquired: true,
                completed: false,
            };
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                // Otra transacción concurrente insertó exactamente en este instante
                const winner = await this.client.inventoryIdempotencyKey.findFirst({
                    where: {
                        tenantId: params.tenantId,
                        key: params.key,
                    },
                });

                if (winner && winner.responseBody !== null && winner.responseBody !== undefined) {
                    return {
                        acquired: false,
                        completed: true,
                        response: winner.responseBody as unknown as T,
                    };
                }

                throw new IdempotencyConflictException(
                    params.key,
                    params.operation,
                    `Conflicto de idempotencia: una operación concurrente ya está en progreso para la clave '${params.key}'`,
                );
            }

            throw error;
        }
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
