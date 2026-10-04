import { CreateStockCountService } from '../../src/application/services/stock-count/create-stock-count.service';
import { ApplyStockCountService } from '../../src/application/services/stock-count/apply-stock-count.service';
import { StockCountStatus } from '../../src/domain/types';
import { InventoryBalance } from '../../src/domain/entities/inventory-balance/entity';
import { Warehouse } from '../../src/domain/entities/warehouse/entity';
import { WarehouseCodeVO } from '../../src/domain/value-objects/warehouse-code.vo';
import {
    InMemoryIdempotencyPort,
    InMemoryInventoryBalanceRepository,
    InMemoryInventoryLedgerRepository,
    InMemoryInventoryMovementRepository,
    InMemoryStockCountRepository,
    InMemoryUnitOfWork,
    InMemoryWarehouseRepository,
} from './mocks/mock-ports';

describe('Stock Count Application Services', () => {
    const tenantId = 'tenant-test-1';
    const warehouseId = 'wh-main';
    const prodSurplus = 'prod-surplus';
    const prodShortage = 'prod-shortage';
    const prodEqual = 'prod-equal';
    const varSurplus = 'var-surplus';
    const varShortage = 'var-shortage';
    const varEqual = 'var-equal';
    const uomId = 'uom-und';

    let warehouseRepo: InMemoryWarehouseRepository;
    let balanceRepo: InMemoryInventoryBalanceRepository;
    let stockCountRepo: InMemoryStockCountRepository;
    let movementRepo: InMemoryInventoryMovementRepository;
    let ledgerRepo: InMemoryInventoryLedgerRepository;
    let idempotencyPort: InMemoryIdempotencyPort;
    let uow: InMemoryUnitOfWork;

    let createService: CreateStockCountService;
    let applyService: ApplyStockCountService;

    beforeEach(async () => {
        warehouseRepo = new InMemoryWarehouseRepository();
        balanceRepo = new InMemoryInventoryBalanceRepository();
        stockCountRepo = new InMemoryStockCountRepository();
        movementRepo = new InMemoryInventoryMovementRepository();
        ledgerRepo = new InMemoryInventoryLedgerRepository();
        idempotencyPort = new InMemoryIdempotencyPort();

        uow = new InMemoryUnitOfWork({
            warehouseRepository: warehouseRepo,
            inventoryBalanceRepository: balanceRepo,
            stockCountRepository: stockCountRepo,
            inventoryMovementRepository: movementRepo,
            inventoryLedgerRepository: ledgerRepo,
            productRepository: {} as any,
            productVariantRepository: {} as any,
            unitOfMeasureRepository: {} as any,
            inventoryTransferRepository: {} as any,
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

        // Seed Balances:
        // 1. Surplus item: system has 10 units @ 2,000 COP
        const balSurplus = InventoryBalance.create({
            id: 'bal-surplus',
            tenantId,
            warehouseId,
            productId: prodSurplus,
            variantId: varSurplus,
            unitOfMeasureId: uomId,
            allowsFraction: false,
            decimalPlaces: 0,
            quantityOnHand: 10,
            averageCost: 2000,
            inventoryValue: 20000,
        });

        // 2. Shortage item: system has 8 units @ 3,000 COP
        const balShortage = InventoryBalance.create({
            id: 'bal-shortage',
            tenantId,
            warehouseId,
            productId: prodShortage,
            variantId: varShortage,
            unitOfMeasureId: uomId,
            allowsFraction: false,
            decimalPlaces: 0,
            quantityOnHand: 8,
            averageCost: 3000,
            inventoryValue: 24000,
        });

        // 3. Equal item: system has 5 units @ 1,000 COP
        const balEqual = InventoryBalance.create({
            id: 'bal-equal',
            tenantId,
            warehouseId,
            productId: prodEqual,
            variantId: varEqual,
            unitOfMeasureId: uomId,
            allowsFraction: false,
            decimalPlaces: 0,
            quantityOnHand: 5,
            averageCost: 1000,
            inventoryValue: 5000,
        });

        await balanceRepo.saveMany([balSurplus, balShortage, balEqual]);

        createService = new CreateStockCountService(warehouseRepo, balanceRepo, stockCountRepo);
        applyService = new ApplyStockCountService(warehouseRepo, stockCountRepo, idempotencyPort, uow);
    });

    it('debe crear un conteo físico capturando los saldos actuales del sistema', async () => {
        const created = await createService.execute({
            tenantId,
            warehouseId,
            autoStart: true,
        });

        expect(created.id).toBeDefined();
        expect(created.status).toBe(StockCountStatus.IN_PROGRESS);
        expect(created.linesCount).toBe(3);
        expect(created.lines.some((l) => l.productId === prodSurplus && l.systemQuantity === '10')).toBe(true);
        expect(created.lines.some((l) => l.productId === prodShortage && l.systemQuantity === '8')).toBe(true);
        expect(created.lines.some((l) => l.productId === prodEqual && l.systemQuantity === '5')).toBe(true);
    });

    it('debe aplicar sobrante, faltante y no generar movimiento para líneas iguales', async () => {
        const created = await createService.execute({
            tenantId,
            warehouseId,
            autoStart: true,
        });

        const lineSurplusId = created.lines.find((l) => l.productId === prodSurplus)!.id;
        const lineShortageId = created.lines.find((l) => l.productId === prodShortage)!.id;
        const lineEqualId = created.lines.find((l) => l.productId === prodEqual)!.id;

        const result = await applyService.execute({
            tenantId,
            stockCountId: created.id,
            counts: [
                { lineId: lineSurplusId, countedQuantity: 12 }, // +2 surplus (counted: 12, system: 10)
                { lineId: lineShortageId, countedQuantity: 5 },  // -3 shortage (counted: 5, system: 8)
                { lineId: lineEqualId, countedQuantity: 5 },     // 0 diff (counted: 5, system: 5)
            ],
        });

        expect(result.status).toBe(StockCountStatus.COMPLETED);
        expect(result.totalLines).toBe(3);
        expect(result.adjustedLines).toBe(2);

        // 1. Surplus balance updated: 10 + 2 = 12 units
        const updatedSurplus = await balanceRepo.findByLocation(tenantId, warehouseId, prodSurplus, varSurplus);
        expect(updatedSurplus!.getQuantityOnHand().getAmount().toNumber()).toBe(12);

        // 2. Shortage balance updated: 8 - 3 = 5 units
        const updatedShortage = await balanceRepo.findByLocation(tenantId, warehouseId, prodShortage, varShortage);
        expect(updatedShortage!.getQuantityOnHand().getAmount().toNumber()).toBe(5);

        // 3. Equal balance unchanged: 5 units
        const updatedEqual = await balanceRepo.findByLocation(tenantId, warehouseId, prodEqual, varEqual);
        expect(updatedEqual!.getQuantityOnHand().getAmount().toNumber()).toBe(5);

        // Movements created: 1 ADJUSTMENT_IN and 1 ADJUSTMENT_OUT
        expect(movementRepo.movements.length).toBe(2);
        const inMov = movementRepo.movements.find((m) => m.getType() === 'ADJUSTMENT_IN');
        const outMov = movementRepo.movements.find((m) => m.getType() === 'ADJUSTMENT_OUT');
        expect(inMov).toBeDefined();
        expect(outMov).toBeDefined();

        // Kardex entries created: 2 entries (one for surplus, one for shortage)
        expect(ledgerRepo.entries.length).toBe(2);
    });
});
