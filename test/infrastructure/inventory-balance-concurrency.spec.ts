import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';

import { InvalidInventoryBalanceException } from '../../src/domain/exceptions/invalid-inventory-balance.exception';
import { InventoryBalance } from '../../src/domain/entities/inventory-balance/entity';
import { QuantityVO } from '../../src/domain/value-objects/quantity.vo';
import { PrismaInventoryBalanceRepository } from '../../src/infrastructure/persistence/prisma/repositories/prisma-inventory-balance.repository';

describe('Infrastructure Concurrency & SELECT FOR UPDATE Tests', () => {
    const tenantId = '11111111-1111-1111-1111-111111111111';
    const warehouseId = '66666666-6666-6666-6666-666666666666';
    const productId = '22222222-2222-2222-2222-222222222222';
    const variantId = '55555555-5555-5555-5555-555555555555';
    const uomId = '33333333-3333-3333-3333-333333333333';

    it('should query PostgreSQL with FOR UPDATE of b in findForUpdate', async () => {
        let executedRawQuery = '';
        const mockPrisma = {
            $queryRaw: jest.fn().mockImplementation((strings: TemplateStringsArray, ...values: any[]) => {
                executedRawQuery = strings.join('?');
                return Promise.resolve([
                    {
                        id: 'balance-uuid-1',
                        tenantId,
                        productId,
                        variantId,
                        warehouseId,
                        quantityOnHand: new Prisma.Decimal('10.000000'),
                        reservedQuantity: new Prisma.Decimal('0.000000'),
                        averageCost: new Prisma.Decimal('5000.000000'),
                        inventoryValue: new Prisma.Decimal('50000.0000'),
                        version: BigInt(1),
                        updatedAt: new Date(),
                        unitOfMeasureId: uomId,
                        decimalPlaces: 3,
                    },
                ]);
            }),
        };

        const repository = new PrismaInventoryBalanceRepository(mockPrisma as any);
        const balance = await repository.findForUpdate(tenantId, warehouseId, productId, variantId);

        expect(balance).not.toBeNull();
        expect(balance!.getQuantityOnHand().getAmount().toFixed(6)).toBe('10.000000');
        expect(executedRawQuery).toContain('FOR UPDATE OF b');
        expect(executedRawQuery).toContain('WHERE b.tenant_id =');
        expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('should sort keys deterministically in findManyForUpdate to prevent deadlocks', async () => {
        const callOrder: string[] = [];

        const mockPrisma = {
            $queryRaw: jest.fn().mockImplementation((strings: TemplateStringsArray, ...values: any[]) => {
                // Track warehouseId, productId, variantId passed
                const wh = values[1];
                const prod = values[2];
                const variant = values[3];
                callOrder.push(`${wh}:${prod}:${variant}`);

                return Promise.resolve([
                    {
                        id: 'balance-uuid',
                        tenantId,
                        productId: prod,
                        variantId: variant,
                        warehouseId: wh,
                        quantityOnHand: new Prisma.Decimal('10.000000'),
                        reservedQuantity: new Prisma.Decimal('0.000000'),
                        averageCost: new Prisma.Decimal('5000.000000'),
                        inventoryValue: new Prisma.Decimal('50000.0000'),
                        version: BigInt(1),
                        updatedAt: new Date(),
                        unitOfMeasureId: uomId,
                        decimalPlaces: 3,
                    },
                ]);
            }),
        };

        const repository = new PrismaInventoryBalanceRepository(mockPrisma as any);

        // Intentionally provide out-of-order keys: WH-Z, WH-A, WH-M
        const unsortedKeys = [
            { warehouseId: 'WH-Z', productId: 'P-1', variantId: 'V-1' },
            { warehouseId: 'WH-A', productId: 'P-1', variantId: 'V-1' },
            { warehouseId: 'WH-M', productId: 'P-1', variantId: 'V-1' },
        ];

        const balances = await repository.findManyForUpdate(tenantId, unsortedKeys);

        expect(balances).toHaveLength(3);
        // The locks must be acquired in strictly alphabetical / deterministic order
        expect(callOrder).toEqual([
            'WH-A:P-1:V-1',
            'WH-M:P-1:V-1',
            'WH-Z:P-1:V-1',
        ]);
    });

    describe('Critical Concurrency Requirement (Section 32)', () => {
        it('Stock = 10; Request A dispatches 7, Request B dispatches 7: one succeeds, one fails with insufficient stock, final stock = 3 (NEVER -4)', async () => {
            // Emulate database state under pessimistic lock
            let dbStock = new Decimal('10.000000');
            let dbValue = new Decimal('50000.0000');
            const unitCost = new Decimal('5000.000000');
            let dbVersion = BigInt(1);

            // Mutex simulating PostgreSQL row-level lock serialization
            let lockQueue: Promise<void> = Promise.resolve();
            const acquireDbLock = async () => {
                let releaseLock: () => void;
                const nextLock = new Promise<void>((resolve) => {
                    releaseLock = resolve;
                });
                const prevLock = lockQueue;
                lockQueue = nextLock;
                await prevLock;
                return () => releaseLock();
            };

            const createTransactionalRepo = () => {
                const mockClient = {
                    $queryRaw: jest.fn().mockImplementation(async () => {
                        return [
                            {
                                id: 'balance-uuid',
                                tenantId,
                                productId,
                                variantId,
                                warehouseId,
                                quantityOnHand: new Prisma.Decimal(dbStock.toString()),
                                reservedQuantity: new Prisma.Decimal('0.000000'),
                                averageCost: new Prisma.Decimal(unitCost.toString()),
                                inventoryValue: new Prisma.Decimal(dbValue.toString()),
                                version: dbVersion,
                                updatedAt: new Date(),
                                unitOfMeasureId: uomId,
                                decimalPlaces: 3,
                            },
                        ];
                    }),
                    inventoryBalance: {
                        upsert: jest.fn().mockImplementation(({ update }: any) => {
                            dbStock = new Decimal(update.quantityOnHand.toString());
                            dbValue = new Decimal(update.inventoryValue.toString());
                            dbVersion = BigInt(update.version.toString());
                            return Promise.resolve({});
                        }),
                    },
                };

                return new PrismaInventoryBalanceRepository(mockClient as any);
            };

            // Business transaction function simulating use case with pessimistic lock
            const dispatchOperation = async (dispatchQty: number) => {
                // Acquire row lock (simulating SELECT FOR UPDATE holding transaction lock)
                const releaseLock = await acquireDbLock();
                try {
                    const repo = createTransactionalRepo();

                    // 1. SELECT FOR UPDATE
                    const balance = await repo.findForUpdate(tenantId, warehouseId, productId, variantId);
                    if (!balance) {
                        throw new Error('Balance not found');
                    }

                    // 2. Domain invariant validation
                    const qtyToDispatch = QuantityVO.create(dispatchQty, {
                        unitOfMeasureId: uomId,
                        allowsFraction: true,
                        decimalPlaces: 3,
                    });

                    // Domain check: will throw InvalidInventoryBalanceException if stock < qty
                    balance.dispatch(qtyToDispatch);

                    // 3. Save modified balance
                    await repo.save(balance);

                    return { success: true, remaining: balance.getQuantityOnHand().getAmount() };
                } finally {
                    // Release lock upon transaction commit or rollback
                    releaseLock();
                }
            };

            // Execute two concurrent requests simultaneously!
            const [resultA, resultB] = await Promise.allSettled([
                dispatchOperation(7),
                dispatchOperation(7),
            ]);

            const successes = [resultA, resultB].filter((r) => r.status === 'fulfilled');
            const failures = [resultA, resultB].filter((r) => r.status === 'rejected');

            // Exactly ONE must succeed and ONE must fail
            expect(successes).toHaveLength(1);
            expect(failures).toHaveLength(1);

            // The failure MUST be InvalidInventoryBalanceException
            const failedReason = (failures[0] as PromiseRejectedResult).reason;
            expect(failedReason).toBeInstanceOf(InvalidInventoryBalanceException);
            expect(failedReason.message).toContain('No hay existencias suficientes');

            // The final stock in DB MUST be exactly 3, NEVER negative -4
            expect(dbStock.toFixed(6)).toBe('3.000000');
            expect(dbValue.toFixed(4)).toBe('15000.0000');
        });
    });
});
