import { TransferStockService } from '../../src/application/services/transfer/transfer-stock.service';
import { ReceiveTransferService } from '../../src/application/services/transfer/receive-transfer.service';
import { WarehouseNotFoundException } from '../../src/application/exceptions';
import { InvalidInventoryBalanceException } from '../../src/domain/exceptions/invalid-inventory-balance.exception';
import { InvalidInventoryTransferException } from '../../src/domain/exceptions/invalid-inventory-transfer.exception';
import { TransferStatus } from '../../src/domain/types';
import { InventoryBalance } from '../../src/domain/entities/inventory-balance/entity';
import { Product } from '../../src/domain/entities/product/entity';
import { ProductVariant } from '../../src/domain/entities/product/variant.entity';
import { UnitOfMeasure, UnitType } from '../../src/domain/entities/unit-of-measure/entity';
import { Warehouse } from '../../src/domain/entities/warehouse/entity';
import { SkuVO } from '../../src/domain/value-objects/sku.vo';
import { UnitOfMeasureCodeVO } from '../../src/domain/value-objects/unit-of-measure-code.vo';
import { WarehouseCodeVO } from '../../src/domain/value-objects/warehouse-code.vo';
import { MoneyVO } from '../../src/domain/value-objects/money.vo';
import {
    InMemoryIdempotencyPort,
    InMemoryInventoryBalanceRepository,
    InMemoryInventoryLedgerRepository,
    InMemoryInventoryMovementRepository,
    InMemoryInventoryTransferRepository,
    InMemoryProductRepository,
    InMemoryProductVariantRepository,
    InMemoryUnitOfMeasureRepository,
    InMemoryUnitOfWork,
    InMemoryWarehouseRepository,
} from './mocks/mock-ports';

describe('TransferStockService and ReceiveTransferService (HU-08)', () => {
    const tenantId = 'tenant-test-1';
    const sourceWhId = 'wh-source';
    const destWhId = 'wh-dest';
    const productId = 'prod-1';
    const variantId = 'var-1';
    const uomId = 'uom-und';

    let balanceRepo: InMemoryInventoryBalanceRepository;
    let movementRepo: InMemoryInventoryMovementRepository;
    let ledgerRepo: InMemoryInventoryLedgerRepository;
    let transferRepo: InMemoryInventoryTransferRepository;
    let warehouseRepo: InMemoryWarehouseRepository;
    let productRepo: InMemoryProductRepository;
    let variantRepo: InMemoryProductVariantRepository;
    let uomRepo: InMemoryUnitOfMeasureRepository;
    let idempotencyPort: InMemoryIdempotencyPort;
    let uow: InMemoryUnitOfWork;

    let transferService: TransferStockService;
    let receiveTransferService: ReceiveTransferService;

    beforeEach(async () => {
        balanceRepo = new InMemoryInventoryBalanceRepository();
        movementRepo = new InMemoryInventoryMovementRepository();
        ledgerRepo = new InMemoryInventoryLedgerRepository();
        transferRepo = new InMemoryInventoryTransferRepository();
        warehouseRepo = new InMemoryWarehouseRepository();
        productRepo = new InMemoryProductRepository();
        variantRepo = new InMemoryProductVariantRepository();
        uomRepo = new InMemoryUnitOfMeasureRepository();
        idempotencyPort = new InMemoryIdempotencyPort();

        uow = new InMemoryUnitOfWork({
            inventoryBalanceRepository: balanceRepo,
            inventoryMovementRepository: movementRepo,
            inventoryLedgerRepository: ledgerRepo,
            inventoryTransferRepository: transferRepo,
            warehouseRepository: warehouseRepo,
            productRepository: productRepo,
            productVariantRepository: variantRepo,
            unitOfMeasureRepository: uomRepo,
            stockCountRepository: {} as any,
        });

        // Seed Warehouses
        const sourceWh = Warehouse.create({
            id: sourceWhId,
            tenantId,
            branchId: 'branch-1',
            code: WarehouseCodeVO.create('BOD-ORIGEN'),
            name: 'Bodega Origen',
        });
        const destWh = Warehouse.create({
            id: destWhId,
            tenantId,
            branchId: 'branch-1',
            code: WarehouseCodeVO.create('BOD-DESTINO'),
            name: 'Bodega Destino',
        });
        await warehouseRepo.save(sourceWh);
        await warehouseRepo.save(destWh);

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
            sku: SkuVO.create('SKU-TRF'),
            name: 'Producto Traslado',
            unitOfMeasureId: uomId,
            costPrice: MoneyVO.create(4000, 'COP'),
            salePrice: MoneyVO.create(6000, 'COP'),
            taxRate: 0,
            minStockAlert: 0,
        });
        await productRepo.save(prod);

        const variant = ProductVariant.create({
            id: variantId,
            tenantId,
            productId,
            sku: SkuVO.create('SKU-TRF'),
            name: 'Producto Traslado',
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

        // Seed Source Balance: 20 units @ 4,000 COP = 80,000 COP
        const sourceBalance = InventoryBalance.create({
            id: 'bal-src',
            tenantId,
            warehouseId: sourceWhId,
            productId,
            variantId,
            unitOfMeasureId: uomId,
            allowsFraction: false,
            decimalPlaces: 0,
            quantityOnHand: 20,
            averageCost: 4000,
            inventoryValue: 80000,
        });
        await balanceRepo.save(sourceBalance);

        transferService = new TransferStockService(
            warehouseRepo,
            variantRepo,
            idempotencyPort,
            uow,
        );

        receiveTransferService = new ReceiveTransferService(
            warehouseRepo,
            idempotencyPort,
            uow,
        );
    });

    it('debe ejecutar un traslado atómico directo (DRAFT -> COMPLETED) en una sola transacción', async () => {
        const result = await transferService.execute({
            tenantId,
            sourceWarehouseId: sourceWhId,
            destinationWarehouseId: destWhId,
            referenceDocument: 'TRF-001',
            isTwoPhase: false, // Atomic transfer
            lines: [{ productId, variantId, quantity: 5 }],
        });

        expect(result.status).toBe(TransferStatus.COMPLETED);
        expect(result.outboundMovementId).toBeDefined();
        expect(result.inboundMovementId).toBeDefined();

        // Source balance: 20 - 5 = 15 units @ 4,000 COP
        const srcBal = await balanceRepo.findByLocation(tenantId, sourceWhId, productId, variantId);
        expect(srcBal!.getQuantityOnHand().getAmount().toNumber()).toBe(15);

        // Destination balance created and received: 5 units @ 4,000 COP = 20,000 COP
        const destBal = await balanceRepo.findByLocation(tenantId, destWhId, productId, variantId);
        expect(destBal).not.toBeNull();
        expect(destBal!.getQuantityOnHand().getAmount().toNumber()).toBe(5);
        expect(destBal!.getAverageCost().getAmount().toNumber()).toBe(4000);
        expect(destBal!.getInventoryValue().getAmount().toNumber()).toBe(20000);

        // Kardex entries: 1 TRANSFER_OUT in source, 1 TRANSFER_IN in dest
        expect(ledgerRepo.entries.length).toBe(2);
        const outEntry = ledgerRepo.entries.find((e) => e.getWarehouseId() === sourceWhId);
        const inEntry = ledgerRepo.entries.find((e) => e.getWarehouseId() === destWhId);
        expect(outEntry!.getMovementType()).toBe('TRANSFER_OUT');
        expect(inEntry!.getMovementType()).toBe('TRANSFER_IN');
    });

    it('debe soportar el ciclo logístico en dos fases (DRAFT -> IN_TRANSIT, luego IN_TRANSIT -> COMPLETED)', async () => {
        // Fase 1: Despacho en tránsito
        const step1 = await transferService.execute({
            tenantId,
            sourceWarehouseId: sourceWhId,
            destinationWarehouseId: destWhId,
            referenceDocument: 'TRF-002',
            isTwoPhase: true,
            lines: [{ productId, variantId, quantity: 8 }],
        });

        expect(step1.status).toBe(TransferStatus.IN_TRANSIT);
        expect(step1.outboundMovementId).toBeDefined();
        expect(step1.inboundMovementId).toBeUndefined();

        // Source inventory decreased: 20 - 8 = 12
        const srcBal = await balanceRepo.findByLocation(tenantId, sourceWhId, productId, variantId);
        expect(srcBal!.getQuantityOnHand().getAmount().toNumber()).toBe(12);

        // Destination has not received stock yet
        const destBalBefore = await balanceRepo.findByLocation(tenantId, destWhId, productId, variantId);
        expect(destBalBefore).toBeNull();

        // Fase 2: Recepción física en destino
        const step2 = await receiveTransferService.execute({
            tenantId,
            transferId: step1.transferId,
        });

        expect(step2.status).toBe(TransferStatus.COMPLETED);
        expect(step2.inboundMovementId).toBeDefined();

        // Destination received stock: 8 units @ 4,000 COP
        const destBalAfter = await balanceRepo.findByLocation(tenantId, destWhId, productId, variantId);
        expect(destBalAfter).not.toBeNull();
        expect(destBalAfter!.getQuantityOnHand().getAmount().toNumber()).toBe(8);
        expect(destBalAfter!.getAverageCost().getAmount().toNumber()).toBe(4000);
    });

    it('debe rechazar un traslado si la bodega origen y destino son la misma', async () => {
        await expect(
            transferService.execute({
                tenantId,
                sourceWarehouseId: sourceWhId,
                destinationWarehouseId: sourceWhId,
                referenceDocument: 'TRF-ERR-1',
                lines: [{ productId, variantId, quantity: 1 }],
            }),
        ).rejects.toThrow(InvalidInventoryTransferException);
    });

    it('debe rechazar el traslado si no hay stock suficiente en la bodega origen', async () => {
        await expect(
            transferService.execute({
                tenantId,
                sourceWarehouseId: sourceWhId,
                destinationWarehouseId: destWhId,
                referenceDocument: 'TRF-ERR-2',
                lines: [{ productId, variantId, quantity: 30 }], // Only 20 available
            }),
        ).rejects.toThrow(InvalidInventoryBalanceException);
    });
});
