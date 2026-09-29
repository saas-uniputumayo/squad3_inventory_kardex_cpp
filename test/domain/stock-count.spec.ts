import { StockCount } from '../../src/domain/entities/stock-count/entity';
import { StockCountLine } from '../../src/domain/entities/stock-count/line.entity';
import { InvalidStockCountLineException } from '../../src/domain/exceptions/invalid-stock-count-line.exception';
import { InvalidStockCountException } from '../../src/domain/exceptions/invalid-stock-count.exception';
import {
    MovementType,
    StockCountLineStatus,
    StockCountStatus,
} from '../../src/domain/types';
import { QuantityVO } from '../../src/domain/value-objects/quantity.vo';

describe('StockCount and StockCountLine', () => {
    const integerUOM = {
        unitOfMeasureId: 'uom-unit',
        allowsFraction: false,
        decimalPlaces: 0,
    };

    describe('StockCountLine Signed Difference Calculation', () => {
        const createLine = (systemQty: number) => {
            return StockCountLine.create({
                id: 'scline-001',
                stockCountId: 'sc-001',
                productId: 'prod-001',
                variantId: 'var-001',
                unitOfMeasureId: 'uom-unit',
                allowsFraction: false,
                decimalPlaces: 0,
                systemQuantity: QuantityVO.create(systemQty, integerUOM),
            });
        };

        it('should calculate surplus when counted > system (positive difference)', () => {
            const line = createLine(10);
            line.count(QuantityVO.create(15, integerUOM));

            expect(line.getStatus()).toBe(StockCountLineStatus.COUNTED);
            expect(line.getDifferenceAmount().toNumber()).toBe(5);
            expect(line.hasDifference()).toBe(true);
            expect(line.isSurplus()).toBe(true);
            expect(line.isShortage()).toBe(false);
            expect(line.getRequiredMovementType()).toBe(MovementType.ADJUSTMENT_IN);
        });

        it('should calculate shortage when counted < system (negative difference without invalid QuantityVO)', () => {
            const line = createLine(10);
            line.count(QuantityVO.create(6, integerUOM));

            expect(line.getDifferenceAmount().toNumber()).toBe(-4);
            expect(line.getAbsDifferenceAmount().toNumber()).toBe(4);
            expect(line.hasDifference()).toBe(true);
            expect(line.isSurplus()).toBe(false);
            expect(line.isShortage()).toBe(true);
            expect(line.getRequiredMovementType()).toBe(MovementType.ADJUSTMENT_OUT);
        });

        it('should calculate zero difference when counted == system', () => {
            const line = createLine(10);
            line.count(QuantityVO.create(10, integerUOM));

            expect(line.getDifferenceAmount().toNumber()).toBe(0);
            expect(line.hasDifference()).toBe(false);
            expect(line.isSurplus()).toBe(false);
            expect(line.isShortage()).toBe(false);
            expect(line.getRequiredMovementType()).toBeNull();
        });

        it('should reject calculating difference before line is counted', () => {
            const line = createLine(10);
            expect(() => line.getDifferenceAmount()).toThrow(
                InvalidStockCountLineException,
            );
        });
    });

    describe('StockCount Aggregate Lifecycle', () => {
        it('should transition through full lifecycle: DRAFT -> IN_PROGRESS -> COMPLETED', () => {
            const count = StockCount.create({
                id: 'sc-001',
                tenantId: 'tenant-123',
                warehouseId: 'wh-main',
                notes: 'Conteo físico fin de mes',
            });

            expect(count.isDraft()).toBe(true);
            expect(count.getStatus()).toBe(StockCountStatus.DRAFT);

            const line = StockCountLine.create({
                id: 'scline-001',
                stockCountId: 'sc-001',
                productId: 'prod-001',
                variantId: 'var-001',
                unitOfMeasureId: 'uom-unit',
                allowsFraction: false,
                decimalPlaces: 0,
                systemQuantity: QuantityVO.create(10, integerUOM),
            });

            count.addLine(line);
            expect(count.getLines()).toHaveLength(1);

            // Start counting
            count.startCounting();
            expect(count.isInProgress()).toBe(true);
            expect(count.getStartedAt()).toBeDefined();

            // Attempting to complete while line is pending must fail
            expect(() => count.complete()).toThrow(InvalidStockCountException);

            // Count the line
            line.count(QuantityVO.create(12, integerUOM));

            // Complete the stock count
            count.complete();
            expect(count.isCompleted()).toBe(true);
            expect(count.getCompletedAt()).toBeDefined();

            // Mark line as applied
            line.markAsApplied();
            expect(line.isApplied()).toBe(true);
        });

        it('should allow cancelling from DRAFT or IN_PROGRESS', () => {
            const count = StockCount.create({
                id: 'sc-002',
                tenantId: 'tenant-123',
                warehouseId: 'wh-main',
            });

            count.cancel();
            expect(count.isCancelled()).toBe(true);
            expect(count.getCancelledAt()).toBeDefined();
        });

        it('should reject modifying lines after DRAFT status', () => {
            const count = StockCount.create({
                id: 'sc-003',
                tenantId: 'tenant-123',
                warehouseId: 'wh-main',
            });

            const line = StockCountLine.create({
                id: 'scline-003',
                stockCountId: 'sc-003',
                productId: 'prod-001',
                variantId: 'var-001',
                unitOfMeasureId: 'uom-unit',
                allowsFraction: false,
                decimalPlaces: 0,
                systemQuantity: QuantityVO.create(10, integerUOM),
            });

            count.addLine(line);
            count.startCounting();

            const newLine = StockCountLine.create({
                id: 'scline-004',
                stockCountId: 'sc-003',
                productId: 'prod-002',
                variantId: 'var-002',
                unitOfMeasureId: 'uom-unit',
                allowsFraction: false,
                decimalPlaces: 0,
                systemQuantity: QuantityVO.create(5, integerUOM),
            });

            expect(() => count.addLine(newLine)).toThrow(
                InvalidStockCountException,
            );
        });
    });
});
