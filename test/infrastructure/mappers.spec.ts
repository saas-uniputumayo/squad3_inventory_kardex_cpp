import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';

import {
    CostMethod,
    Product,
    ProductStatus,
    ProductStructure,
    ProductType,
} from '../../src/domain/entities/product/entity';
import {
    ProductVariant,
    ProductVariantStatus,
} from '../../src/domain/entities/product/variant.entity';
import {
    Warehouse,
    WarehouseStatus,
} from '../../src/domain/entities/warehouse/entity';
import {
    UnitOfMeasure,
    UnitOfMeasureStatus,
    UnitType,
} from '../../src/domain/entities/unit-of-measure/entity';
import {
    InventoryBalance,
} from '../../src/domain/entities/inventory-balance/entity';
import {
    InventoryMovement,
} from '../../src/domain/entities/inventory-movement/entity';
import {
    InventoryMovementLine,
} from '../../src/domain/entities/inventory-movement/line.entity';
import {
    InventoryLedgerEntry,
} from '../../src/domain/entities/inventory-ledger-entry/entity';
import {
    InventoryTransfer,
    TransferStatus,
} from '../../src/domain/entities/inventory-transfer/entity';
import {
    InventoryTransferLine,
} from '../../src/domain/entities/inventory-transfer/line.entity';
import {
    StockCount,
} from '../../src/domain/entities/stock-count/entity';
import {
    StockCountLine,
} from '../../src/domain/entities/stock-count/line.entity';
import {
    MovementSource,
    MovementType,
    ReferenceType,
    StockCountLineStatus,
    StockCountStatus,
} from '../../src/domain/types';
import { MoneyVO } from '../../src/domain/value-objects/money.vo';
import { MovementReferenceVO } from '../../src/domain/value-objects/movement-reference.vo';
import { QuantityVO } from '../../src/domain/value-objects/quantity.vo';
import { SkuVO } from '../../src/domain/value-objects/sku.vo';
import { TransferReferenceVO } from '../../src/domain/value-objects/transfer-reference.vo';
import { UnitCostVO } from '../../src/domain/value-objects/unit-cost.vo';
import { UnitOfMeasureCodeVO } from '../../src/domain/value-objects/unit-of-measure-code.vo';
import { WarehouseCodeVO } from '../../src/domain/value-objects/warehouse-code.vo';
import { ProductMapper } from '../../src/infrastructure/persistence/prisma/mappers/product.mapper';
import { ProductVariantMapper } from '../../src/infrastructure/persistence/prisma/mappers/product-variant.mapper';
import { WarehouseMapper } from '../../src/infrastructure/persistence/prisma/mappers/warehouse.mapper';
import { UnitOfMeasureMapper } from '../../src/infrastructure/persistence/prisma/mappers/unit-of-measure.mapper';
import { InventoryBalanceMapper } from '../../src/infrastructure/persistence/prisma/mappers/inventory-balance.mapper';
import { InventoryMovementMapper } from '../../src/infrastructure/persistence/prisma/mappers/inventory-movement.mapper';
import { InventoryLedgerMapper } from '../../src/infrastructure/persistence/prisma/mappers/inventory-ledger.mapper';
import { InventoryTransferMapper } from '../../src/infrastructure/persistence/prisma/mappers/inventory-transfer.mapper';
import { StockCountMapper } from '../../src/infrastructure/persistence/prisma/mappers/stock-count.mapper';

describe('Infrastructure Mappers - Precision & Lossless Transformation', () => {
    const tenantId = '11111111-1111-1111-1111-111111111111';
    const now = new Date('2026-10-04T12:00:00.000Z');

    describe('ProductMapper', () => {
        it('should map between Prisma Product and Domain Product without precision loss', () => {
            const domainProduct = Product.rehydrate({
                id: '22222222-2222-2222-2222-222222222222',
                tenantId,
                sku: SkuVO.create('PROD-001'),
                name: 'Harina de Trigo Especial',
                description: 'Bulto de harina 50kg',
                barcode: '7701234567890',
                categoryId: null,
                productType: ProductType.STOCKABLE,
                structure: ProductStructure.SIMPLE,
                status: ProductStatus.ACTIVE,
                costPrice: MoneyVO.create(new Decimal('125000.550000')),
                salePrice: MoneyVO.create(new Decimal('160000.00')),
                wholesalePrice: MoneyVO.create(new Decimal('145000.00')),
                taxRate: new Decimal('0.19'),
                minStockAlert: new Decimal('10.500000'),
                unitOfMeasureId: '33333333-3333-3333-3333-333333333333',
                costMethod: CostMethod.WEIGHTED_AVERAGE,
                createdAt: now,
                updatedAt: now,
                archivedAt: null,
            });

            const persistenceData = ProductMapper.toPersistence(domainProduct);
            expect(persistenceData.costPrice.toString()).toBe('125000.55');
            expect(persistenceData.salePrice.toString()).toBe('160000');
            expect(persistenceData.minStockAlert.toString()).toBe('10.5');

            // Reconstruct Prisma representation
            const rawPrisma = {
                id: persistenceData.id,
                tenantId: persistenceData.tenantId,
                sku: persistenceData.sku,
                name: persistenceData.name,
                description: persistenceData.description,
                barcode: persistenceData.barcode,
                categoryId: persistenceData.categoryId,
                productType: persistenceData.productType,
                status: persistenceData.status,
                costPrice: persistenceData.costPrice as Prisma.Decimal,
                salePrice: persistenceData.salePrice as Prisma.Decimal,
                wholesalePrice: persistenceData.wholesalePrice as Prisma.Decimal,
                taxRate: persistenceData.taxRate as Prisma.Decimal,
                minStockAlert: persistenceData.minStockAlert as Prisma.Decimal,
                unitOfMeasureId: persistenceData.unitOfMeasureId,
                costMethod: persistenceData.costMethod,
                createdAt: persistenceData.createdAt as Date,
                updatedAt: persistenceData.updatedAt as Date,
                archivedAt: persistenceData.archivedAt as Date | null,
            };

            const mappedDomain = ProductMapper.toDomain(rawPrisma as any);
            expect(mappedDomain.getId()).toBe(domainProduct.getId());
            expect(mappedDomain.getSku().getValue()).toBe('PROD-001');
            expect(mappedDomain.getCostPrice().getAmount().toFixed(6)).toBe('125000.550000');
            expect(mappedDomain.getSalePrice().getAmount().toFixed(2)).toBe('160000.00');
            expect(mappedDomain.getMinStockAlert().toFixed(6)).toBe('10.500000');
        });
    });

    describe('InventoryBalanceMapper', () => {
        it('should map between Prisma InventoryBalance and Domain InventoryBalance with high decimal precision', () => {
            const rawRecord = {
                id: '44444444-4444-4444-4444-444444444444',
                tenantId,
                productId: '22222222-2222-2222-2222-222222222222',
                variantId: '55555555-5555-5555-5555-555555555555',
                warehouseId: '66666666-6666-6666-6666-666666666666',
                quantityOnHand: new Prisma.Decimal('125.750000'),
                reservedQuantity: new Prisma.Decimal('15.250000'),
                averageCost: new Prisma.Decimal('12345.678912'),
                inventoryValue: new Prisma.Decimal('1552469.1232'),
                version: BigInt(3),
                updatedAt: now,
                unitOfMeasureId: '33333333-3333-3333-3333-333333333333',
                decimalPlaces: 3,
                allowsFraction: true,
                currency: 'COP',
            };

            const domainBalance = InventoryBalanceMapper.toDomain(rawRecord as any);
            expect(domainBalance.getQuantityOnHand().getAmount().toFixed(6)).toBe('125.750000');
            expect(domainBalance.getReservedQuantity().getAmount().toFixed(6)).toBe('15.250000');
            expect(domainBalance.getAvailableStock().getAmount().toFixed(6)).toBe('110.500000');
            expect(domainBalance.getAverageCost().getAmount().toFixed(6)).toBe('12345.678912');
            expect(domainBalance.getInventoryValue().getAmount().toFixed(4)).toBe('1552469.1232');
            expect(domainBalance.getVersion()).toBe(3);

            const persistenceData = InventoryBalanceMapper.toPersistence(domainBalance);
            expect(persistenceData.quantityOnHand.toString()).toBe('125.75');
            expect(persistenceData.reservedQuantity.toString()).toBe('15.25');
            expect(persistenceData.averageCost.toString()).toBe('12345.678912');
            expect(persistenceData.inventoryValue.toString()).toBe('1552469.1232');
            expect(persistenceData.version).toBe(BigInt(3));
        });
    });

    describe('InventoryLedgerMapper', () => {
        it('should map immutable Kardex entry accurately without altering values', () => {
            const rawLedger = {
                id: '77777777-7777-7777-7777-777777777777',
                tenantId,
                sequence: BigInt(1045),
                movementId: '88888888-8888-8888-8888-888888888888',
                productId: '22222222-2222-2222-2222-222222222222',
                variantId: '55555555-5555-5555-5555-555555555555',
                warehouseId: '66666666-6666-6666-6666-666666666666',
                movementType: MovementType.PURCHASE_RECEIPT,
                quantityIn: new Prisma.Decimal('50.000000'),
                quantityOut: new Prisma.Decimal('0.000000'),
                quantityDelta: new Prisma.Decimal('50.000000'),
                quantityBalance: new Prisma.Decimal('150.000000'),
                unitCost: new Prisma.Decimal('12000.000000'),
                costDelta: new Prisma.Decimal('600000.0000'),
                averageCostBefore: new Prisma.Decimal('10000.000000'),
                averageCostAfter: new Prisma.Decimal('10666.666667'),
                inventoryValueBefore: new Prisma.Decimal('1000000.0000'),
                inventoryValueAfter: new Prisma.Decimal('1600000.0000'),
                referenceType: ReferenceType.PURCHASE,
                referenceId: '99999999-9999-9999-9999-999999999999',
                referenceDocument: 'FAC-00123',
                createdAt: now,
                unitOfMeasureId: '33333333-3333-3333-3333-333333333333',
                decimalPlaces: 3,
                allowsFraction: true,
                source: MovementSource.PURCHASE,
                currency: 'COP',
            };

            const domainEntry = InventoryLedgerMapper.toDomain(rawLedger as any);
            expect(domainEntry.getId()).toBe('77777777-7777-7777-7777-777777777777');
            expect(domainEntry.getMovementType()).toBe(MovementType.PURCHASE_RECEIPT);
            expect(domainEntry.getQuantityIn()?.getAmount().toFixed(6)).toBe('50.000000');
            expect(domainEntry.getQuantityOut()).toBeUndefined();
            expect(domainEntry.getQuantityDelta().toFixed(6)).toBe('50.000000');
            expect(domainEntry.getBalanceQuantity().getAmount().toFixed(6)).toBe('150.000000');
            expect(domainEntry.getBalanceAverageCost().getAmount().toFixed(6)).toBe('10666.666667');
            expect(domainEntry.getBalanceValue().getAmount().toFixed(4)).toBe('1600000.0000');

            const persistenceData = InventoryLedgerMapper.toPersistence(domainEntry);
            expect(persistenceData.quantityIn.toString()).toBe('50');
            expect(persistenceData.quantityBalance.toString()).toBe('150');
            expect(persistenceData.averageCostBefore.toString()).toBe('10000');
            expect(persistenceData.averageCostAfter.toString()).toBe('10666.666667');
            expect(persistenceData.inventoryValueAfter.toString()).toBe('1600000');
        });
    });

    describe('InventoryMovementMapper', () => {
        it('should map movement and lines correctly', () => {
            const rawMovement = {
                id: '88888888-8888-8888-8888-888888888888',
                tenantId,
                type: MovementType.PURCHASE_RECEIPT,
                status: 'POSTED',
                source: MovementSource.PURCHASE,
                warehouseId: '66666666-6666-6666-6666-666666666666',
                referenceType: ReferenceType.PURCHASE,
                referenceId: '99999999-9999-9999-9999-999999999999',
                referenceDocument: 'PURCHASE:99999999-9999-9999-9999-999999999999',
                reason: 'Recepción de orden de compra #123',
                createdAt: now,
                updatedAt: now,
                postedAt: now,
                reversedAt: null,
                reversesMovementId: null,
                lines: [
                    {
                        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                        movementId: '88888888-8888-8888-8888-888888888888',
                        lineNumber: 1,
                        productId: '22222222-2222-2222-2222-222222222222',
                        variantId: '55555555-5555-5555-5555-555555555555',
                        unitOfMeasureId: '33333333-3333-3333-3333-333333333333',
                        quantity: new Prisma.Decimal('20.000000'),
                        unitCost: new Prisma.Decimal('15000.000000'),
                        totalCost: new Prisma.Decimal('300000.0000'),
                        createdAt: now,
                        unitOfMeasure: { decimalPlaces: 3 },
                    },
                ],
            };

            const domainMovement = InventoryMovementMapper.toDomain(rawMovement as any);
            expect(domainMovement.getId()).toBe(rawMovement.id);
            expect(domainMovement.getType()).toBe(MovementType.PURCHASE_RECEIPT);
            expect(domainMovement.getLines()).toHaveLength(1);
            expect(domainMovement.getLines()[0].getQuantity().getAmount().toFixed(6)).toBe('20.000000');
            expect(domainMovement.getLines()[0].getUnitCost().getAmount().toFixed(6)).toBe('15000.000000');
            expect(domainMovement.getLines()[0].getTotalCost().getAmount().toFixed(4)).toBe('300000.0000');

            const persistenceMovement = InventoryMovementMapper.toPersistence(domainMovement);
            expect(persistenceMovement.id).toBe(rawMovement.id);
            expect(persistenceMovement.type).toBe(MovementType.PURCHASE_RECEIPT);

            const persistenceLine = InventoryMovementMapper.toLinePersistence(
                domainMovement.getLines()[0],
                tenantId,
                0,
            );
            expect(persistenceLine.quantity.toString()).toBe('20');
            expect(persistenceLine.unitCost.toString()).toBe('15000');
            expect(persistenceLine.totalCost.toString()).toBe('300000');
        });
    });

    describe('WarehouseMapper & UnitOfMeasureMapper', () => {
        it('should map Warehouse correctly', () => {
            const rawWarehouse = {
                id: '66666666-6666-6666-6666-666666666666',
                tenantId,
                branchId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
                code: 'BOD-CENTRAL',
                name: 'Bodega Principal Mocoa',
                description: 'Bodega de despacho principal',
                status: 'ACTIVE',
                createdAt: now,
                updatedAt: now,
                archivedAt: null,
            };

            const domainWh = WarehouseMapper.toDomain(rawWarehouse as any);
            expect(domainWh.getId()).toBe(rawWarehouse.id);
            expect(domainWh.getCode().getValue()).toBe('BOD-CENTRAL');
            expect(domainWh.canPerformInventoryOperations()).toBe(true);

            const persistenceWh = WarehouseMapper.toPersistence(domainWh);
            expect(persistenceWh.code).toBe('BOD-CENTRAL');
            expect(persistenceWh.name).toBe('Bodega Principal Mocoa');
        });

        it('should map UnitOfMeasure correctly', () => {
            const rawUom = {
                id: '33333333-3333-3333-3333-333333333333',
                tenantId,
                code: 'KGM',
                name: 'Kilogramo',
                symbol: 'kg',
                unitType: UnitType.WEIGHT,
                decimalPlaces: 3,
                conversionFactor: new Prisma.Decimal('1.000000'),
                isActive: true,
                createdAt: now,
                updatedAt: now,
            };

            const domainUom = UnitOfMeasureMapper.toDomain(rawUom as any);
            expect(domainUom.getId()).toBe(rawUom.id);
            expect(domainUom.getCode().getValue()).toBe('KGM');
            expect(domainUom.getAllowsFraction()).toBe(true);
            expect(domainUom.getDecimalPlaces()).toBe(3);

            const persistenceUom = UnitOfMeasureMapper.toPersistence(domainUom);
            expect(persistenceUom.code).toBe('KGM');
            expect(persistenceUom.decimalPlaces).toBe(3);
            expect(persistenceUom.isActive).toBe(true);
        });
    });
});
