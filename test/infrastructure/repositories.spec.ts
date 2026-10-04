import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';

import {
    MovementSource,
    MovementType,
    ReferenceType,
} from '../../src/domain/types';
import { InventoryLedgerEntry } from '../../src/domain/entities/inventory-ledger-entry/entity';
import { MoneyVO } from '../../src/domain/value-objects/money.vo';
import { QuantityVO } from '../../src/domain/value-objects/quantity.vo';
import { UnitCostVO } from '../../src/domain/value-objects/unit-cost.vo';
import { PrismaInventoryLedgerRepository } from '../../src/infrastructure/persistence/prisma/repositories/prisma-inventory-ledger.repository';
import { PrismaProductRepository } from '../../src/infrastructure/persistence/prisma/repositories/prisma-product.repository';
import { PrismaWarehouseRepository } from '../../src/infrastructure/persistence/prisma/repositories/prisma-warehouse.repository';

describe('Infrastructure Repositories & Multi-Tenant Isolation Tests', () => {
    const tenantA = '11111111-1111-1111-1111-111111111111';
    const tenantB = '22222222-2222-2222-2222-222222222222';
    const warehouseId = '66666666-6666-6666-6666-666666666666';
    const productId = '33333333-3333-3333-3333-333333333333';
    const variantId = '44444444-4444-4444-4444-444444444444';
    const uomId = '55555555-5555-5555-5555-555555555555';

    describe('Multi-Tenant Isolation Defense in Depth', () => {
        it('PrismaProductRepository must never allow Tenant A to find or delete Tenant B products', async () => {
            const mockPrisma = {
                product: {
                    findFirst: jest.fn().mockImplementation(({ where }) => {
                        // If Tenant A queries, but the product belongs to Tenant B, it should return null
                        if (where.tenantId === tenantA && where.id === 'prod-b') {
                            return Promise.resolve(null);
                        }
                        return Promise.resolve(null);
                    }),
                    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
                },
            };

            const repo = new PrismaProductRepository(mockPrisma as any);

            // Tenant A queries product from Tenant B
            const product = await repo.findById(tenantA, 'prod-b');
            expect(product).toBeNull();
            expect(mockPrisma.product.findFirst).toHaveBeenCalledWith({
                where: {
                    tenantId: tenantA,
                    id: 'prod-b',
                },
            });

            // Tenant A tries to delete product from Tenant B
            await repo.delete(tenantA, 'prod-b');
            expect(mockPrisma.product.deleteMany).toHaveBeenCalledWith({
                where: {
                    tenantId: tenantA,
                    id: 'prod-b',
                },
            });
        });

        it('PrismaWarehouseRepository must enforce tenantId in all queries', async () => {
            const mockPrisma = {
                warehouse: {
                    findFirst: jest.fn().mockResolvedValue(null),
                    findMany: jest.fn().mockResolvedValue([]),
                },
            };

            const repo = new PrismaWarehouseRepository(mockPrisma as any);
            await repo.findByCode(tenantA, 'BOD-01');

            expect(mockPrisma.warehouse.findFirst).toHaveBeenCalledWith({
                where: {
                    tenantId: tenantA,
                    code: 'BOD-01',
                },
            });

            await repo.findAll(tenantA, { onlyActive: true });
            expect(mockPrisma.warehouse.findMany).toHaveBeenCalledWith({
                where: {
                    tenantId: tenantA,
                    status: 'ACTIVE',
                },
                orderBy: { name: 'asc' },
            });
        });
    });

    describe('PrismaInventoryLedgerRepository (Append-Only Kardex)', () => {
        it('should append Kardex entries without providing update or delete methods', async () => {
            const createdEntries: any[] = [];
            const mockPrisma = {
                inventoryLedgerEntry: {
                    create: jest.fn().mockImplementation(({ data }) => {
                        createdEntries.push(data);
                        return Promise.resolve({ ...data, sequence: BigInt(createdEntries.length) });
                    }),
                    findMany: jest.fn().mockResolvedValue([]),
                    count: jest.fn().mockResolvedValue(0),
                },
            };

            const repo = new PrismaInventoryLedgerRepository(mockPrisma as any);

            // Verify repository is strictly append-only (no update/delete methods exist)
            expect((repo as any).update).toBeUndefined();
            expect((repo as any).delete).toBeUndefined();
            expect((repo as any).deleteMany).toBeUndefined();

            const ledgerEntry = InventoryLedgerEntry.create({
                id: 'ledger-uuid-1',
                tenantId: tenantA,
                warehouseId,
                movementId: 'mov-1',
                movementLineId: 'line-1',
                productId,
                variantId,
                unitOfMeasureId: uomId,
                allowsFraction: true,
                decimalPlaces: 3,
                movementType: MovementType.PURCHASE_RECEIPT,
                source: MovementSource.PURCHASE,
                quantityIn: QuantityVO.create(10, { unitOfMeasureId: uomId, allowsFraction: true, decimalPlaces: 3 }),
                unitCost: UnitCostVO.create(2000, 'COP'),
                totalValue: MoneyVO.create(20000, 'COP'),
                balanceQuantity: QuantityVO.create(10, { unitOfMeasureId: uomId, allowsFraction: true, decimalPlaces: 3 }),
                balanceValue: MoneyVO.create(20000, 'COP'),
                balanceAverageCost: UnitCostVO.create(2000, 'COP'),
                averageCostBefore: UnitCostVO.create(0, 'COP'),
                averageCostAfter: UnitCostVO.create(2000, 'COP'),
                inventoryValueBefore: MoneyVO.create(0, 'COP'),
                inventoryValueAfter: MoneyVO.create(20000, 'COP'),
                referenceType: ReferenceType.PURCHASE,
                referenceId: 'fac-001',
            });

            await repo.save(ledgerEntry);

            expect(createdEntries).toHaveLength(1);
            expect(createdEntries[0].id).toBe('ledger-uuid-1');
            expect(createdEntries[0].tenantId).toBe(tenantA);
            expect(createdEntries[0].quantityIn.toString()).toBe('10');
            expect(createdEntries[0].quantityBalance.toString()).toBe('10');
            expect(createdEntries[0].costDelta.toString()).toBe('20000');
        });
    });
});
