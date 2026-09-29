import { InventoryTransfer } from '../../src/domain/entities/inventory-transfer/entity';
import { InventoryTransferLine } from '../../src/domain/entities/inventory-transfer/line.entity';
import { InvalidInventoryTransferException } from '../../src/domain/exceptions/invalid-inventory-transfer.exception';
import { TransferStatus } from '../../src/domain/types';
import { TransferReferenceVO } from '../../src/domain/value-objects/transfer-reference.vo';

describe('InventoryTransfer Aggregate and TransferLine', () => {
    const createValidTransfer = () => {
        const line = InventoryTransferLine.create({
            id: 'tr-line-001',
            transferId: 'transfer-001',
            productId: 'prod-001',
            variantId: 'var-001',
            unitOfMeasureId: 'uom-unit',
            allowsFraction: false,
            decimalPlaces: 0,
            quantity: 10,
        });

        return InventoryTransfer.create({
            id: 'transfer-001',
            tenantId: 'tenant-123',
            sourceWarehouseId: 'wh-source',
            destinationWarehouseId: 'wh-dest',
            reference: TransferReferenceVO.create('TR-2026-001'),
            lines: [line],
        });
    };

    describe('Creation and Invariants', () => {
        it('should create valid transfer in DRAFT status', () => {
            const transfer = createValidTransfer();

            expect(transfer.getStatus()).toBe(TransferStatus.DRAFT);
            expect(transfer.isDraft()).toBe(true);
            expect(transfer.getLines()).toHaveLength(1);
        });

        it('should reject transfer when source and destination warehouses are identical', () => {
            const line = InventoryTransferLine.create({
                id: 'tr-line-002',
                transferId: 'transfer-002',
                productId: 'prod-001',
                variantId: 'var-001',
                unitOfMeasureId: 'uom-unit',
                allowsFraction: false,
                decimalPlaces: 0,
                quantity: 5,
            });

            expect(() =>
                InventoryTransfer.create({
                    id: 'transfer-002',
                    tenantId: 'tenant-123',
                    sourceWarehouseId: 'wh-same',
                    destinationWarehouseId: 'wh-same',
                    reference: TransferReferenceVO.create('TR-2026-002'),
                    lines: [line],
                }),
            ).toThrow(InvalidInventoryTransferException);
        });
    });

    describe('Path 1: Physical Transit Transfer (2 phases per Prisma IN_TRANSIT)', () => {
        it('should support physical dispatch to IN_TRANSIT, then reception to COMPLETED', () => {
            const transfer = createValidTransfer();

            // Phase 1: Dispatch -> IN_TRANSIT
            transfer.dispatch('mov-out-001');
            expect(transfer.isInTransit()).toBe(true);
            expect(transfer.getStatus()).toBe(TransferStatus.IN_TRANSIT);
            expect(transfer.getOutboundMovementId()).toBe('mov-out-001');

            // Cannot re-dispatch when in transit
            expect(() => transfer.dispatch('mov-out-002')).toThrow(
                InvalidInventoryTransferException,
            );

            // Phase 2: Receive -> COMPLETED
            transfer.receive('mov-in-001', 'user-receiver');
            expect(transfer.isCompleted()).toBe(true);
            expect(transfer.getStatus()).toBe(TransferStatus.COMPLETED);
            expect(transfer.getInboundMovementId()).toBe('mov-in-001');
            expect(transfer.getCompletedById()).toBe('user-receiver');
            expect(transfer.getCompletedAt()).toBeDefined();
        });

        it('should reject receive() if transfer is still in DRAFT', () => {
            const transfer = createValidTransfer();
            expect(() => transfer.receive('mov-in-001')).toThrow(
                InvalidInventoryTransferException,
            );
        });
    });

    describe('Path 2: Atomic Transfer (1 step per HU-08 and Resumen Proyecto Sec. 9)', () => {
        it('should support atomic direct completion from DRAFT via completeAtomic()', () => {
            const transfer = createValidTransfer();

            transfer.completeAtomic('mov-out-001', 'mov-in-001', 'user-admin');

            expect(transfer.isCompleted()).toBe(true);
            expect(transfer.getOutboundMovementId()).toBe('mov-out-001');
            expect(transfer.getInboundMovementId()).toBe('mov-in-001');
            expect(transfer.getCompletedById()).toBe('user-admin');
            expect(transfer.getCompletedAt()).toBeDefined();
        });

        it('should reject completeAtomic() if transfer was already dispatched into IN_TRANSIT', () => {
            const transfer = createValidTransfer();
            transfer.dispatch('mov-out-001');

            expect(() =>
                transfer.completeAtomic('mov-out-002', 'mov-in-002'),
            ).toThrow(InvalidInventoryTransferException);
        });
    });

    describe('Terminal states: Cancellation and Reversal', () => {
        it('should allow reversal only of COMPLETED transfers', () => {
            const transfer = createValidTransfer();
            expect(() => transfer.reverse()).toThrow(InvalidInventoryTransferException);

            transfer.complete('mov-direct-001');
            transfer.reverse();
            expect(transfer.isReversed()).toBe(true);
            expect(transfer.getStatus()).toBe(TransferStatus.REVERSED);

            // Re-reversing must fail
            expect(() => transfer.reverse()).toThrow(InvalidInventoryTransferException);
        });

        it('should allow cancellation from DRAFT and IN_TRANSIT, but reject from COMPLETED', () => {
            const transfer1 = createValidTransfer();
            transfer1.cancel();
            expect(transfer1.isCancelled()).toBe(true);
            expect(transfer1.getCancelledAt()).toBeDefined();

            const transfer2 = createValidTransfer();
            transfer2.dispatch('mov-out-001');
            transfer2.cancel();
            expect(transfer2.isCancelled()).toBe(true);

            const transfer3 = createValidTransfer();
            transfer3.complete('mov-direct-001');
            expect(() => transfer3.cancel()).toThrow(InvalidInventoryTransferException);
        });
    });
});
