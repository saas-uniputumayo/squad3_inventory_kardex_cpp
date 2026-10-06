import { Prisma } from '@prisma/client';
import { IdempotencyConflictException } from '../../src/application/exceptions/idempotency-conflict.exception';
import { IdempotencyStatus } from '../../src/application/ports/out/idempotency.port';
import { TenantContext } from '../../src/infrastructure/context/tenant-context';
import { PrismaIdempotencyAdapter } from '../../src/infrastructure/persistence/prisma/idempotency/prisma-idempotency.adapter';
import { PrismaUnitOfWork } from '../../src/infrastructure/persistence/prisma/unit-of-work/prisma-unit-of-work';

describe('PrismaUnitOfWork & PrismaIdempotencyAdapter Tests', () => {
    const tenantId = '11111111-1111-1111-1111-111111111111';

    describe('PrismaUnitOfWork', () => {
        it('should execute inside transaction and set RLS context with set_current_tenant', async () => {
            const rawQueriesExecuted: string[] = [];

            const mockTx = {
                $executeRawUnsafe: jest.fn().mockImplementation((query: string, ...params: any[]) => {
                    rawQueriesExecuted.push(query);
                    return Promise.resolve(1);
                }),
                product: { upsert: jest.fn() },
                productVariant: { upsert: jest.fn() },
                warehouse: { upsert: jest.fn() },
                unitOfMeasure: { findFirst: jest.fn() },
                inventoryBalance: { upsert: jest.fn() },
                inventoryMovement: { upsert: jest.fn() },
                inventoryMovementLine: { upsert: jest.fn() },
                inventoryLedgerEntry: { create: jest.fn() },
                inventoryTransfer: { upsert: jest.fn() },
                inventoryTransferLine: { upsert: jest.fn() },
                stockCount: { upsert: jest.fn() },
                stockCountLine: { upsert: jest.fn() },
            };

            const mockPrismaService = {
                $transaction: jest.fn().mockImplementation(async (callback: any) => {
                    return await callback(mockTx);
                }),
            };

            const uow = new PrismaUnitOfWork(mockPrismaService as any);

            // Execute within TenantContext
            const result = await TenantContext.run({ tenantId }, async () => {
                return await uow.execute(async (ctx) => {
                    expect(ctx.productRepository).toBeDefined();
                    expect(ctx.inventoryBalanceRepository).toBeDefined();
                    expect(ctx.inventoryLedgerRepository).toBeDefined();
                    expect(ctx.inventoryMovementRepository).toBeDefined();
                    expect(ctx.inventoryTransferRepository).toBeDefined();
                    expect(ctx.stockCountRepository).toBeDefined();

                    return 'transaction-success';
                });
            });

            expect(result).toBe('transaction-success');
            expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
            expect(rawQueriesExecuted).toContain('SELECT set_current_tenant($1::uuid)');
            expect(mockTx.$executeRawUnsafe).toHaveBeenCalledWith(
                'SELECT set_current_tenant($1::uuid)',
                tenantId,
            );
        });

        it('should rollback transaction when an error occurs', async () => {
            const mockPrismaService = {
                $transaction: jest.fn().mockImplementation(async (callback: any) => {
                    const mockTx = {
                        $executeRawUnsafe: jest.fn().mockResolvedValue(1),
                    };
                    return await callback(mockTx);
                }),
            };

            const uow = new PrismaUnitOfWork(mockPrismaService as any);

            await expect(
                uow.execute(async () => {
                    throw new Error('Database integrity error inside transaction');
                }),
            ).rejects.toThrow('Database integrity error inside transaction');
        });
    });

    describe('PrismaIdempotencyAdapter', () => {
        it('should get null when key is not registered', async () => {
            const mockPrisma = {
                inventoryIdempotencyKey: {
                    findFirst: jest.fn().mockResolvedValue(null),
                },
            };

            const adapter = new PrismaIdempotencyAdapter(mockPrisma as any);
            const record = await adapter.get(tenantId, 'key-non-existent');

            expect(record).toBeNull();
            expect(mockPrisma.inventoryIdempotencyKey.findFirst).toHaveBeenCalledWith({
                where: { tenantId, key: 'key-non-existent' },
            });
        });

        it('should return completed record when responseBody is present', async () => {
            const mockRecord = {
                id: 'key-uuid-1',
                tenantId,
                key: 'key-abc-123',
                operation: 'INVENTORY_RECEIVE',
                requestHash: 'sha256:key-abc-123',
                statusCode: 200,
                responseBody: { movementId: 'mov-1', success: true },
                resourceId: 'mov-1',
                createdAt: new Date(),
                expiresAt: null,
            };

            const mockPrisma = {
                inventoryIdempotencyKey: {
                    findFirst: jest.fn().mockResolvedValue(mockRecord),
                },
            };

            const adapter = new PrismaIdempotencyAdapter(mockPrisma as any);
            const record = await adapter.get<{ movementId: string; success: boolean }>(
                tenantId,
                'key-abc-123',
            );

            expect(record).not.toBeNull();
            expect(record!.status).toBe(IdempotencyStatus.COMPLETED);
            expect(record!.response).toEqual({ movementId: 'mov-1', success: true });
            expect(record!.resourceId).toBe('mov-1');
        });

        it('should save idempotency key with TTL and response body', async () => {
            const mockPrisma = {
                inventoryIdempotencyKey: {
                    upsert: jest.fn().mockResolvedValue({}),
                },
            };

            const adapter = new PrismaIdempotencyAdapter(mockPrisma as any);
            await adapter.save({
                tenantId,
                key: 'key-test-456',
                operation: 'INVENTORY_DISPATCH',
                response: { dispatchId: 'disp-1' },
                ttlSeconds: 3600,
            });

            expect(mockPrisma.inventoryIdempotencyKey.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        tenantId_key: {
                            tenantId,
                            key: 'key-test-456',
                        },
                    },
                    create: expect.objectContaining({
                        tenantId,
                        key: 'key-test-456',
                        operation: 'INVENTORY_DISPATCH',
                        statusCode: 200,
                        responseBody: { dispatchId: 'disp-1' },
                    }),
                }),
            );
        });

        it('should release idempotency key when requested', async () => {
            const mockPrisma = {
                inventoryIdempotencyKey: {
                    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
                },
            };

            const adapter = new PrismaIdempotencyAdapter(mockPrisma as any);
            await adapter.release(tenantId, 'key-error-retry');

            expect(mockPrisma.inventoryIdempotencyKey.deleteMany).toHaveBeenCalledWith({
                where: {
                    tenantId,
                    key: 'key-error-retry',
                },
            });
        });

        describe('acquire (Atomic Concurrency Control)', () => {
            it('should successfully acquire key when it does not exist', async () => {
                const mockPrisma = {
                    inventoryIdempotencyKey: {
                        findFirst: jest.fn().mockResolvedValue(null),
                        create: jest.fn().mockResolvedValue({ id: 'new-key-id' }),
                    },
                };

                const adapter = new PrismaIdempotencyAdapter(mockPrisma as any);
                const result = await adapter.acquire({
                    tenantId,
                    key: 'key-first-time',
                    operation: 'RECEIVE_STOCK',
                });

                expect(result.acquired).toBe(true);
                expect(result.completed).toBe(false);
                expect(mockPrisma.inventoryIdempotencyKey.create).toHaveBeenCalledWith(
                    expect.objectContaining({
                        data: expect.objectContaining({
                            tenantId,
                            key: 'key-first-time',
                            operation: 'RECEIVE_STOCK',
                        }),
                    }),
                );
            });

            it('should return stored response if key is already COMPLETED', async () => {
                const mockCompletedRecord = {
                    id: 'completed-id',
                    tenantId,
                    key: 'key-already-done',
                    operation: 'RECEIVE_STOCK',
                    responseBody: { movementId: 'mov-done-123' },
                    createdAt: new Date(),
                    expiresAt: null,
                };

                const mockPrisma = {
                    inventoryIdempotencyKey: {
                        findFirst: jest.fn().mockResolvedValue(mockCompletedRecord),
                    },
                };

                const adapter = new PrismaIdempotencyAdapter(mockPrisma as any);
                const result = await adapter.acquire<{ movementId: string }>({
                    tenantId,
                    key: 'key-already-done',
                    operation: 'RECEIVE_STOCK',
                });

                expect(result.acquired).toBe(false);
                expect(result.completed).toBe(true);
                expect(result.response).toEqual({ movementId: 'mov-done-123' });
            });

            it('should throw IdempotencyConflictException when key is STARTED and within timeout', async () => {
                const mockStartedRecord = {
                    id: 'in-flight-id',
                    tenantId,
                    key: 'key-in-flight',
                    operation: 'DISPATCH_STOCK',
                    responseBody: null,
                    createdAt: new Date(Date.now() - 5000), // 5 seconds ago (< 60s timeout)
                    expiresAt: null,
                };

                const mockPrisma = {
                    inventoryIdempotencyKey: {
                        findFirst: jest.fn().mockResolvedValue(mockStartedRecord),
                    },
                };

                const adapter = new PrismaIdempotencyAdapter(mockPrisma as any);

                await expect(
                    adapter.acquire({
                        tenantId,
                        key: 'key-in-flight',
                        operation: 'DISPATCH_STOCK',
                    }),
                ).rejects.toThrow(IdempotencyConflictException);
            });

            it('should reclaim orphan key if STARTED state exceeded lock timeout (>60s)', async () => {
                const mockOrphanRecord = {
                    id: 'orphan-id',
                    tenantId,
                    key: 'key-crashed-process',
                    operation: 'RECEIVE_STOCK',
                    responseBody: null,
                    createdAt: new Date(Date.now() - 70000), // 70 seconds ago (> 60s timeout)
                    expiresAt: null,
                };

                const mockPrisma = {
                    inventoryIdempotencyKey: {
                        findFirst: jest.fn().mockResolvedValue(mockOrphanRecord),
                        update: jest.fn().mockResolvedValue({ id: 'orphan-id' }),
                    },
                };

                const adapter = new PrismaIdempotencyAdapter(mockPrisma as any);
                const result = await adapter.acquire({
                    tenantId,
                    key: 'key-crashed-process',
                    operation: 'RECEIVE_STOCK',
                });

                expect(result.acquired).toBe(true);
                expect(result.completed).toBe(false);
                expect(mockPrisma.inventoryIdempotencyKey.update).toHaveBeenCalledWith(
                    expect.objectContaining({
                        where: { id: 'orphan-id' },
                    }),
                );
            });

            it('should handle unique constraint collision (P2002) when two requests race to insert', async () => {
                const p2002Error = new Prisma.PrismaClientKnownRequestError(
                    'Unique constraint failed on the fields: (`tenant_id`,`key`)',
                    {
                        code: 'P2002',
                        clientVersion: '6.0.0',
                    },
                );

                const mockWinnerRecord = {
                    id: 'winner-id',
                    tenantId,
                    key: 'key-racing',
                    operation: 'TRANSFER_STOCK',
                    responseBody: null, // Still in flight by the winner
                    createdAt: new Date(),
                };

                const mockPrisma = {
                    inventoryIdempotencyKey: {
                        findFirst: jest
                            .fn()
                            .mockResolvedValueOnce(null) // Request doesn't see it initially
                            .mockResolvedValueOnce(mockWinnerRecord), // After P2002, finds the winner's record
                        create: jest.fn().mockRejectedValue(p2002Error), // Collides with winner in PostgreSQL
                    },
                };

                const adapter = new PrismaIdempotencyAdapter(mockPrisma as any);

                await expect(
                    adapter.acquire({
                        tenantId,
                        key: 'key-racing',
                        operation: 'TRANSFER_STOCK',
                    }),
                ).rejects.toThrow(IdempotencyConflictException);
            });
        });
    });
});
