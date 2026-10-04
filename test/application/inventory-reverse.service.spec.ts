import { ReverseMovementService } from '../../src/application/services/inventory/reverse-movement.service';
import { MovementNotFoundException } from '../../src/application/exceptions';
import { InvalidInventoryMovementException } from '../../src/domain/exceptions/invalid-inventory-movement.exception';
import { InventoryBalance } from '../../src/domain/entities/inventory-balance/entity';
import { InventoryMovement } from '../../src/domain/entities/inventory-movement/entity';
import { InventoryMovementLine } from '../../src/domain/entities/inventory-movement/line.entity';
import {
    MovementSource,
    MovementStatus,
    MovementType,
    ReferenceType,
} from '../../src/domain/types';
import { MovementReferenceVO } from '../../src/domain/value-objects/movement-reference.vo';
import {
    InMemoryIdempotencyPort,
    InMemoryInventoryBalanceRepository,
    InMemoryInventoryLedgerRepository,
    InMemoryInventoryMovementRepository,
    InMemoryUnitOfWork,
} from './mocks/mock-ports';

describe('ReverseMovementService (HU-07)', () => {
    const tenantId = 'tenant-test-1';
    const warehouseId = 'wh-main';
    const productId = 'prod-1';
    const variantId = 'var-1';
    const uomId = 'uom-und';

    let balanceRepo: InMemoryInventoryBalanceRepository;
    let movementRepo: InMemoryInventoryMovementRepository;
    let ledgerRepo: InMemoryInventoryLedgerRepository;
    let idempotencyPort: InMemoryIdempotencyPort;
    let uow: InMemoryUnitOfWork;

    let reverseService: ReverseMovementService;

    beforeEach(async () => {
        balanceRepo = new InMemoryInventoryBalanceRepository();
        movementRepo = new InMemoryInventoryMovementRepository();
        ledgerRepo = new InMemoryInventoryLedgerRepository();
        idempotencyPort = new InMemoryIdempotencyPort();

        uow = new InMemoryUnitOfWork({
            inventoryBalanceRepository: balanceRepo,
            inventoryMovementRepository: movementRepo,
            inventoryLedgerRepository: ledgerRepo,
            warehouseRepository: {} as any,
            productRepository: {} as any,
            productVariantRepository: {} as any,
            unitOfMeasureRepository: {} as any,
            inventoryTransferRepository: {} as any,
            stockCountRepository: {} as any,
        });

        // Initial Balance: 6 units @ 5,000 COP
        const initialBalance = InventoryBalance.create({
            id: 'bal-1',
            tenantId,
            warehouseId,
            productId,
            variantId,
            unitOfMeasureId: uomId,
            allowsFraction: false,
            decimalPlaces: 0,
            quantityOnHand: 6,
            averageCost: 5000,
            inventoryValue: 30000,
        });
        await balanceRepo.save(initialBalance);

        reverseService = new ReverseMovementService(
            idempotencyPort,
            uow,
        );
    });

    it('debe revertir una venta (SALE) creando contra-movimiento VOID_RETURN y restaurando stock', async () => {
        // Create original SALE movement
        const originalMovId = 'mov-sale-original';
        const movLine = InventoryMovementLine.create({
            id: 'line-sale-1',
            movementId: originalMovId,
            productId,
            variantId,
            unitOfMeasureId: uomId,
            allowsFraction: false,
            decimalPlaces: 0,
            currency: 'COP',
            quantity: 4,
            unitCost: 5000,
            totalCost: 20000,
            lineNumber: 1,
        });

        const originalMov = InventoryMovement.create({
            id: originalMovId,
            tenantId,
            warehouseId,
            type: MovementType.SALE_DISPATCH,
            status: MovementStatus.POSTED,
            source: MovementSource.POS,
            reference: MovementReferenceVO.create(ReferenceType.POS_SALE, 'FAC-100'),
            lines: [movLine],
        });
        await movementRepo.save(originalMov);

        const result = await reverseService.execute({
            tenantId,
            movementId: originalMovId,
            reason: 'Cliente canceló la factura',
        });

        expect(result.reversedMovementId).toBe(originalMovId);
        expect(result.status).toBe(MovementStatus.POSTED);

        // Verify original movement is marked REVERSED and NOT deleted
        const reloadedOriginal = await movementRepo.findById(tenantId, originalMovId);
        expect(reloadedOriginal).not.toBeNull();
        expect(reloadedOriginal!.getStatus()).toBe(MovementStatus.REVERSED);

        // Verify contra movement was created and posted
        const contraMov = await movementRepo.findById(tenantId, result.reversalMovementId);
        expect(contraMov).not.toBeNull();
        expect(contraMov!.getType()).toBe(MovementType.VOID_RETURN);
        expect(contraMov!.getStatus()).toBe(MovementStatus.POSTED);

        // Verify stock was restored: 6 + 4 = 10 units
        const balance = await balanceRepo.findByLocation(tenantId, warehouseId, productId, variantId);
        expect(balance!.getQuantityOnHand().getAmount().toNumber()).toBe(10);

        // Verify Kardex ledger entry recorded contra-movement
        expect(ledgerRepo.entries.length).toBe(1);
        expect(ledgerRepo.entries[0].getMovementType()).toBe(MovementType.VOID_RETURN);
        expect(ledgerRepo.entries[0].getBalanceQuantity().getAmount().toNumber()).toBe(10);
    });

    it('debe rechazar la reversión si el movimiento ya fue revertido previamente', async () => {
        const originalMovId = 'mov-already-rev';
        const movLine = InventoryMovementLine.create({
            id: 'line-1',
            movementId: originalMovId,
            productId,
            variantId,
            unitOfMeasureId: uomId,
            allowsFraction: false,
            decimalPlaces: 0,
            currency: 'COP',
            quantity: 1,
            unitCost: 5000,
            totalCost: 5000,
            lineNumber: 1,
        });

        const originalMov = InventoryMovement.create({
            id: originalMovId,
            tenantId,
            warehouseId,
            type: MovementType.SALE_DISPATCH,
            status: MovementStatus.REVERSED, // Already reversed!
            source: MovementSource.POS,
            reference: MovementReferenceVO.create(ReferenceType.POS_SALE, 'FAC-100'),
            lines: [movLine],
        });
        await movementRepo.save(originalMov);

        await expect(
            reverseService.execute({
                tenantId,
                movementId: originalMovId,
                reason: 'Intento de doble reversa',
            }),
        ).rejects.toThrow(InvalidInventoryMovementException);
    });

    it('debe lanzar MovementNotFoundException si el movimiento no existe', async () => {
        await expect(
            reverseService.execute({
                tenantId,
                movementId: 'non-existing-movement',
                reason: 'Error',
            }),
        ).rejects.toThrow(MovementNotFoundException);
    });
});
