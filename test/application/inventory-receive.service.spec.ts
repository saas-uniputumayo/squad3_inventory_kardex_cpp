import { ReceiveStockService } from '../../src/application/services/inventory/receive-stock.service';
import { InventoryBalance } from '../../src/domain/entities/inventory-balance/entity';
import { Product } from '../../src/domain/entities/product/entity';
import { ProductVariant } from '../../src/domain/entities/product/variant.entity';
import { UnitOfMeasure, UnitType } from '../../src/domain/entities/unit-of-measure/entity';
import { Warehouse } from '../../src/domain/entities/warehouse/entity';
import { MoneyVO } from '../../src/domain/value-objects/money.vo';
import { SkuVO } from '../../src/domain/value-objects/sku.vo';
import { UnitOfMeasureCodeVO } from '../../src/domain/value-objects/unit-of-measure-code.vo';
import { WarehouseCodeVO } from '../../src/domain/value-objects/warehouse-code.vo';
import {
    InMemoryIdempotencyPort,
    InMemoryInventoryBalanceRepository,
    InMemoryInventoryLedgerRepository,
    InMemoryInventoryMovementRepository,
    InMemoryProductRepository,
    InMemoryProductVariantRepository,
    InMemoryUnitOfMeasureRepository,
    InMemoryUnitOfWork,
    InMemoryWarehouseRepository,
} from './mocks/mock-ports';

describe('ReceiveStockService (HU-06)', () => {
    const tenantId = 'tenant-test-1';
    const warehouseId = 'wh-main';
    const productId = 'prod-1';
    const variantId = 'var-1';
    const uomId = 'uom-und';

    let balanceRepo: InMemoryInventoryBalanceRepository;
    let movementRepo: InMemoryInventoryMovementRepository;
    let ledgerRepo: InMemoryInventoryLedgerRepository;
    let warehouseRepo: InMemoryWarehouseRepository;
    let productRepo: InMemoryProductRepository;
    let variantRepo: InMemoryProductVariantRepository;
    let uomRepo: InMemoryUnitOfMeasureRepository;
    let idempotencyPort: InMemoryIdempotencyPort;
    let uow: InMemoryUnitOfWork;

    let receiveService: ReceiveStockService;

    beforeEach(async () => {
        balanceRepo = new InMemoryInventoryBalanceRepository();
        movementRepo = new InMemoryInventoryMovementRepository();
        ledgerRepo = new InMemoryInventoryLedgerRepository();
        warehouseRepo = new InMemoryWarehouseRepository();
        productRepo = new InMemoryProductRepository();
        variantRepo = new InMemoryProductVariantRepository();
        uomRepo = new InMemoryUnitOfMeasureRepository();
        idempotencyPort = new InMemoryIdempotencyPort();

        uow = new InMemoryUnitOfWork({
            inventoryBalanceRepository: balanceRepo,
            inventoryMovementRepository: movementRepo,
            inventoryLedgerRepository: ledgerRepo,
            warehouseRepository: warehouseRepo,
            productRepository: productRepo,
            productVariantRepository: variantRepo,
            unitOfMeasureRepository: uomRepo,
            inventoryTransferRepository: {} as any,
            stockCountRepository: {} as any,
        });

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

        // Seed Product & Variant
        const prod = Product.create({
            id: productId,
            tenantId,
            sku: SkuVO.create('SKU-100'),
            name: 'Articulo Compra',
            unitOfMeasureId: uomId,
            costPrice: MoneyVO.create(1000, 'COP'),
            salePrice: MoneyVO.create(2000, 'COP'),
            taxRate: 0,
            minStockAlert: 0,
        });
        await productRepo.save(prod);

        const variant = ProductVariant.create({
            id: variantId,
            tenantId,
            productId,
            sku: SkuVO.create('SKU-100'),
            name: 'Articulo Compra',
            unitOfMeasureId: uomId,
            isDefault: true,
            costPrice: prod.getCostPrice(),
            salePrice: prod.getSalePrice(),
            wholesalePrice: prod.getWholesalePrice(),
            taxRate: prod.getTaxRate(),
            minStockAlert: prod.getMinStockAlert(),
            costMethod: prod.getCostMethod(),
        });
        await variantRepo.save(variant);

        // Initial Balance: 10 units @ 1,000 COP = 10,000 COP
        const initialBalance = InventoryBalance.create({
            id: 'bal-1',
            tenantId,
            warehouseId,
            productId,
            variantId,
            unitOfMeasureId: uomId,
            allowsFraction: false,
            decimalPlaces: 0,
            quantityOnHand: 10,
            averageCost: 1000,
            inventoryValue: 10000,
        });
        await balanceRepo.save(initialBalance);

        receiveService = new ReceiveStockService(
            warehouseRepo,
            productRepo,
            variantRepo,
            uomRepo,
            idempotencyPort,
            uow,
        );
    });

    it('debe recibir stock por compra y delegar el recalculo de CPP canónico al Dominio', async () => {
        // Receiving 10 units @ 2,000 COP:
        // New Value = 10,000 + (10 * 2,000) = 30,000 COP
        // New Quantity = 10 + 10 = 20 units
        // New CPP = 30,000 / 20 = 1,500 COP
        const result = await receiveService.execute({
            tenantId,
            warehouseId,
            referenceDocument: 'COM-001',
            lines: [
                {
                    productId,
                    variantId,
                    quantity: 10,
                    unitCost: 2000,
                },
            ],
            idempotencyKey: 'idemp-rec-1',
        });

        expect(result.movementId).toBeDefined();
        expect(result.lines.length).toBe(1);
        expect(result.lines[0].newAverageCost).toBe('1500.000000');
        expect(result.lines[0].newStock).toBe('20');

        // Check balance updated in repository
        const updatedBalance = await balanceRepo.findByLocation(tenantId, warehouseId, productId, variantId);
        expect(updatedBalance!.getQuantityOnHand().getAmount().toNumber()).toBe(20);
        expect(updatedBalance!.getAverageCost().getAmount().toNumber()).toBe(1500);
        expect(updatedBalance!.getInventoryValue().getAmount().toNumber()).toBe(30000);

        // Check Kardex entry
        expect(ledgerRepo.entries.length).toBe(1);
        const ledger = ledgerRepo.entries[0];
        expect(ledger.getMovementType()).toBe('PURCHASE_RECEIPT');
        expect(ledger.getQuantityIn()!.getAmount().toNumber()).toBe(10);
        expect(ledger.getBalanceAverageCost().getAmount().toNumber()).toBe(1500);
        expect(ledger.getBalanceValue().getAmount().toNumber()).toBe(30000);
    });

    it('debe manejar idempotencia correctamente y no duplicar entradas', async () => {
        const cmd = {
            tenantId,
            warehouseId,
            referenceDocument: 'COM-RETRY',
            lines: [{ productId, variantId, quantity: 5, unitCost: 1000 }],
            idempotencyKey: 'rec-key-repeat',
        };

        const res1 = await receiveService.execute(cmd);
        const res2 = await receiveService.execute(cmd);

        expect(res2.movementId).toBe(res1.movementId);
        expect(uow.executeCount).toBe(1);

        // Stock was added only once: 10 + 5 = 15
        const balance = await balanceRepo.findByLocation(tenantId, warehouseId, productId, variantId);
        expect(balance!.getQuantityOnHand().getAmount().toNumber()).toBe(15);
    });
});
