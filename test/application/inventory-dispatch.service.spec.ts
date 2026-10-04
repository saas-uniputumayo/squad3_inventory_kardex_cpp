import { DispatchStockService } from '../../src/application/services/inventory/dispatch-stock.service';
import {
    IdempotencyConflictException,
    WarehouseNotFoundException,
} from '../../src/application/exceptions';
import { InvalidInventoryBalanceException } from '../../src/domain/exceptions/invalid-inventory-balance.exception';
import { InvalidWarehouseException } from '../../src/domain/exceptions/invalid-warehouse.exception';
import { IdempotencyStatus } from '../../src/application/ports/out/idempotency.port';
import { InventoryBalance } from '../../src/domain/entities/inventory-balance/entity';
import { Product } from '../../src/domain/entities/product/entity';
import { ProductVariant } from '../../src/domain/entities/product/variant.entity';
import { UnitOfMeasure, UnitType } from '../../src/domain/entities/unit-of-measure/entity';
import { Warehouse } from '../../src/domain/entities/warehouse/entity';
import { SkuVO } from '../../src/domain/value-objects/sku.vo';
import { WarehouseCodeVO } from '../../src/domain/value-objects/warehouse-code.vo';
import { UnitOfMeasureCodeVO } from '../../src/domain/value-objects/unit-of-measure-code.vo';
import { MoneyVO } from '../../src/domain/value-objects/money.vo';
import { MovementType } from '../../src/domain/types';
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

describe('DispatchStockService (HU-05)', () => {
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

    let dispatchService: DispatchStockService;

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
            name: 'Articulo Prueba',
            unitOfMeasureId: uomId,
            costPrice: MoneyVO.create(5000, 'COP'),
            salePrice: MoneyVO.create(8000, 'COP'),
            taxRate: 0,
            minStockAlert: 0,
        });
        await productRepo.save(prod);

        const variant = ProductVariant.create({
            id: variantId,
            tenantId,
            productId,
            sku: SkuVO.create('SKU-100'),
            name: 'Articulo Prueba',
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

        // Seed Initial InventoryBalance: 10 units @ 5,000 COP = 50,000 COP
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
            averageCost: 5000,
            inventoryValue: 50000,
        });
        await balanceRepo.save(initialBalance);

        dispatchService = new DispatchStockService(
            warehouseRepo,
            productVariantRepositoryPortWrapper(variantRepo),
            idempotencyPort,
            uow,
        );
    });

    function productVariantRepositoryPortWrapper(repo: InMemoryProductVariantRepository) {
        return repo;
    }

    it('debe despachar stock con éxito, actualizando balance, creando movimiento y Kardex', async () => {
        const result = await dispatchService.execute({
            tenantId,
            warehouseId,
            referenceDocument: 'FAC-001',
            lines: [
                {
                    productId,
                    variantId,
                    quantity: 4,
                },
            ],
            idempotencyKey: 'idemp-disp-1',
        });

        expect(result.movementId).toBeDefined();
        expect(result.lines.length).toBe(1);
        expect(result.lines[0].quantity).toBe('4');
        expect(result.lines[0].unitCost).toBe('5000.000000');
        expect(result.lines[0].totalCost).toBe('20000.0000');

        // Check balance updated in repository: 10 - 4 = 6 units
        const updatedBalance = await balanceRepo.findByLocation(tenantId, warehouseId, productId, variantId);
        expect(updatedBalance!.getQuantityOnHand().getAmount().toNumber()).toBe(6);
        expect(updatedBalance!.getInventoryValue().getAmount().toNumber()).toBe(30000);
        expect(updatedBalance!.getAverageCost().getAmount().toNumber()).toBe(5000);

        // Check movement created
        const movement = await movementRepo.findById(tenantId, result.movementId);
        expect(movement).not.toBeNull();
        expect(movement!.getType()).toBe(MovementType.SALE_DISPATCH);
        expect(movement!.getStatus()).toBe('POSTED');

        // Check Kardex ledger entry created
        expect(ledgerRepo.entries.length).toBe(1);
        const ledger = ledgerRepo.entries[0];
        expect(ledger.getMovementType()).toBe(MovementType.SALE_DISPATCH);
        expect(ledger.getQuantityOut()!.getAmount().toNumber()).toBe(4);
        expect(ledger.getBalanceQuantity().getAmount().toNumber()).toBe(6);
        expect(ledger.getBalanceValue().getAmount().toNumber()).toBe(30000);

        // Check UnitOfWork executed
        expect(uow.executeCount).toBe(1);
    });

    it('debe propagar InvalidInventoryBalanceException si el stock solicitado excede la existencia', async () => {
        await expect(
            dispatchService.execute({
                tenantId,
                warehouseId,
                referenceDocument: 'FAC-EXCESS',
                lines: [
                    {
                        productId,
                        variantId,
                        quantity: 15, // Only 10 available
                    },
                ],
            }),
        ).rejects.toThrow(InvalidInventoryBalanceException);

        // Balance remains unchanged
        const balance = await balanceRepo.findByLocation(tenantId, warehouseId, productId, variantId);
        expect(balance!.getQuantityOnHand().getAmount().toNumber()).toBe(10);
    });

    it('debe devolver el resultado en caché sin reejecutar ante un reintento idempotente', async () => {
        const first = await dispatchService.execute({
            tenantId,
            warehouseId,
            referenceDocument: 'FAC-IDEMP',
            lines: [{ productId, variantId, quantity: 2 }],
            idempotencyKey: 'key-idemp-test',
        });

        // Second call with same key
        const second = await dispatchService.execute({
            tenantId,
            warehouseId,
            referenceDocument: 'FAC-IDEMP',
            lines: [{ productId, variantId, quantity: 2 }],
            idempotencyKey: 'key-idemp-test',
        });

        expect(second.movementId).toBe(first.movementId);
        expect(uow.executeCount).toBe(1); // Not executed again!

        // Balance deducted only once: 10 - 2 = 8
        const balance = await balanceRepo.findByLocation(tenantId, warehouseId, productId, variantId);
        expect(balance!.getQuantityOnHand().getAmount().toNumber()).toBe(8);
    });

    it('debe lanzar IdempotencyConflictException si la clave de idempotencia está en proceso (STARTED)', async () => {
        idempotencyPort.setRecord(tenantId, 'key-in-flight', {
            key: 'key-in-flight',
            tenantId,
            operation: 'DISPATCH_STOCK',
            status: IdempotencyStatus.STARTED,
            createdAt: new Date(),
        });

        await expect(
            dispatchService.execute({
                tenantId,
                warehouseId,
                referenceDocument: 'FAC-CONCURRENT',
                lines: [{ productId, variantId, quantity: 1 }],
                idempotencyKey: 'key-in-flight',
            }),
        ).rejects.toThrow(IdempotencyConflictException);
    });

    it('debe rechazar despacho si la bodega no existe o está inactiva', async () => {
        await expect(
            dispatchService.execute({
                tenantId,
                warehouseId: 'wh-inexistente',
                referenceDocument: 'FAC-001',
                lines: [{ productId, variantId, quantity: 1 }],
            }),
        ).rejects.toThrow(WarehouseNotFoundException);
    });
});
