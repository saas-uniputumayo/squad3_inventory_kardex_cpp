import { GetKardexService } from '../../src/application/services/inventory/get-kardex.service';
import { GetStockAlertsService } from '../../src/application/services/inventory/get-stock-alerts.service';
import { InventoryLedgerEntry } from '../../src/domain/entities/inventory-ledger-entry/entity';
import { Product } from '../../src/domain/entities/product/entity';
import { UnitOfMeasure, UnitType } from '../../src/domain/entities/unit-of-measure/entity';
import { Warehouse } from '../../src/domain/entities/warehouse/entity';
import {
    MovementSource,
    MovementType,
    ReferenceType,
} from '../../src/domain/types';
import { MoneyVO } from '../../src/domain/value-objects/money.vo';
import { QuantityVO } from '../../src/domain/value-objects/quantity.vo';
import { SkuVO } from '../../src/domain/value-objects/sku.vo';
import { UnitCostVO } from '../../src/domain/value-objects/unit-cost.vo';
import { UnitOfMeasureCodeVO } from '../../src/domain/value-objects/unit-of-measure-code.vo';
import { WarehouseCodeVO } from '../../src/domain/value-objects/warehouse-code.vo';
import {
    InMemoryInventoryBalanceRepository,
    InMemoryInventoryLedgerRepository,
    InMemoryProductRepository,
    InMemoryUnitOfMeasureRepository,
    InMemoryWarehouseRepository,
} from './mocks/mock-ports';

describe('Query Application Services (HU-09 Kardex, HU-10 Stock Alerts)', () => {
    const tenantId = 'tenant-test-1';
    const warehouseId = 'wh-main';
    const productId = 'prod-1';
    const variantId = 'var-1';
    const uomId = 'uom-und';

    let ledgerRepo: InMemoryInventoryLedgerRepository;
    let balanceRepo: InMemoryInventoryBalanceRepository;
    let productRepo: InMemoryProductRepository;
    let warehouseRepo: InMemoryWarehouseRepository;
    let uomRepo: InMemoryUnitOfMeasureRepository;

    let kardexService: GetKardexService;
    let alertsService: GetStockAlertsService;

    beforeEach(async () => {
        ledgerRepo = new InMemoryInventoryLedgerRepository();
        balanceRepo = new InMemoryInventoryBalanceRepository();
        productRepo = new InMemoryProductRepository();
        warehouseRepo = new InMemoryWarehouseRepository();
        uomRepo = new InMemoryUnitOfMeasureRepository();

        // Seed Warehouse
        const wh = Warehouse.create({
            id: warehouseId,
            tenantId,
            branchId: 'branch-1',
            code: WarehouseCodeVO.create('BOD-01'),
            name: 'Bodega Principal',
        });
        await warehouseRepo.save(wh);

        // Seed UOM
        const uom = UnitOfMeasure.create({
            id: uomId,
            tenantId,
            code: UnitOfMeasureCodeVO.create('UND'),
            name: 'Unidad',
            type: UnitType.UNIT,
            allowsFraction: false,
            decimalPlaces: 0,
        });
        await uomRepo.save(uom);

        // Seed Product
        const prod = Product.create({
            id: productId,
            tenantId,
            sku: SkuVO.create('SKU-100'),
            name: 'Articulo Prueba',
            unitOfMeasureId: uomId,
            costPrice: MoneyVO.create(1000, 'COP'),
            salePrice: MoneyVO.create(2000, 'COP'),
            taxRate: 0,
            minStockAlert: 0,
        });
        await productRepo.save(prod);

        kardexService = new GetKardexService(productRepo, warehouseRepo, uomRepo, ledgerRepo);
        alertsService = new GetStockAlertsService(balanceRepo);

        // Seed Kardex ledger entries:
        // Entry 1: Initial Purchase of 10 @ 1,000 COP
        const entry1 = InventoryLedgerEntry.create({
            id: 'led-1',
            tenantId,
            warehouseId,
            movementId: 'mov-1',
            movementLineId: 'line-1',
            productId,
            variantId,
            unitOfMeasureId: uomId,
            allowsFraction: false,
            decimalPlaces: 0,
            currency: 'COP',
            movementType: MovementType.PURCHASE_RECEIPT,
            source: MovementSource.PURCHASE,
            quantityIn: QuantityVO.create(10, { unitOfMeasureId: uomId, allowsFraction: false, decimalPlaces: 0 }),
            unitCost: UnitCostVO.create(1000, 'COP'),
            totalValue: MoneyVO.create(10000, 'COP'),
            balanceQuantity: QuantityVO.create(10, { unitOfMeasureId: uomId, allowsFraction: false, decimalPlaces: 0 }),
            balanceAverageCost: UnitCostVO.create(1000, 'COP'),
            balanceValue: MoneyVO.create(10000, 'COP'),
            averageCostBefore: UnitCostVO.create(0, 'COP'),
            averageCostAfter: UnitCostVO.create(1000, 'COP'),
            inventoryValueBefore: MoneyVO.create(0, 'COP'),
            inventoryValueAfter: MoneyVO.create(10000, 'COP'),
            referenceType: ReferenceType.PURCHASE,
            referenceDocument: 'COM-001',
            occurredAt: new Date('2026-01-01T10:00:00Z'),
        });

        // Entry 2: Sale of 4 @ 1,000 COP
        const entry2 = InventoryLedgerEntry.create({
            id: 'led-2',
            tenantId,
            warehouseId,
            movementId: 'mov-2',
            movementLineId: 'line-2',
            productId,
            variantId,
            unitOfMeasureId: uomId,
            allowsFraction: false,
            decimalPlaces: 0,
            currency: 'COP',
            movementType: MovementType.SALE_DISPATCH,
            source: MovementSource.POS,
            quantityOut: QuantityVO.create(4, { unitOfMeasureId: uomId, allowsFraction: false, decimalPlaces: 0 }),
            unitCost: UnitCostVO.create(1000, 'COP'),
            totalValue: MoneyVO.create(4000, 'COP'),
            balanceQuantity: QuantityVO.create(6, { unitOfMeasureId: uomId, allowsFraction: false, decimalPlaces: 0 }),
            balanceAverageCost: UnitCostVO.create(1000, 'COP'),
            balanceValue: MoneyVO.create(6000, 'COP'),
            averageCostBefore: UnitCostVO.create(1000, 'COP'),
            averageCostAfter: UnitCostVO.create(1000, 'COP'),
            inventoryValueBefore: MoneyVO.create(10000, 'COP'),
            inventoryValueAfter: MoneyVO.create(6000, 'COP'),
            referenceType: ReferenceType.POS_SALE,
            referenceDocument: 'FAC-001',
            occurredAt: new Date('2026-01-02T15:00:00Z'),
        });

        await ledgerRepo.saveMany([entry1, entry2]);
    });

    describe('GetKardexService (HU-09)', () => {
        it('debe consultar el Kardex cronológico con todos los campos contables requeridos', async () => {
            const result = await kardexService.execute({
                tenantId,
                productId,
                warehouseId,
                variantId,
            });

            expect(result.pagination.total).toBe(2);
            expect(result.entries.length).toBe(2);

            const first = result.entries[0];
            expect(first.movementType).toBe('PURCHASE_RECEIPT');
            expect(first.quantityIn).toBe('10');
            expect(first.quantityOut).toBe('0');
            expect(first.unitCost).toBe('1000.000000');
            expect(first.quantityBalance).toBe('10');
            expect(first.inventoryValue).toBe('10000.0000');

            const second = result.entries[1];
            expect(second.movementType).toBe('SALE_DISPATCH');
            expect(second.quantityIn).toBe('0');
            expect(second.quantityOut).toBe('4');
            expect(second.quantityBalance).toBe('6');
            expect(second.inventoryValue).toBe('6000.0000');
        });

        it('es una consulta pura que no altera el estado de inventario', async () => {
            const countBefore = ledgerRepo.entries.length;
            await kardexService.execute({ tenantId, productId });
            expect(ledgerRepo.entries.length).toBe(countBefore);
        });
    });

    describe('GetStockAlertsService (HU-10)', () => {
        it('debe ejecutar la consulta de alertas de stock mínimo', async () => {
            const alerts = await alertsService.execute({
                tenantId,
                warehouseId,
            });

            expect(alerts.meta.total).toBe(0); // Mock returns empty array
            expect(Array.isArray(alerts.data)).toBe(true);
        });
    });
});
