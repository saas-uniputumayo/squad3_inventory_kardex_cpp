import Decimal from 'decimal.js';
import { InventoryMovement } from '../../src/domain/entities/inventory-movement/entity';
import { InventoryMovementLine } from '../../src/domain/entities/inventory-movement/line.entity';
import { InvalidInventoryMovementException } from '../../src/domain/exceptions/invalid-inventory-movement.exception';
import {
    MovementSource,
    MovementStatus,
    MovementType,
    ReferenceType,
} from '../../src/domain/types';
import { MovementReferenceVO } from '../../src/domain/value-objects/movement-reference.vo';
import { QuantityVO } from '../../src/domain/value-objects/quantity.vo';
import { UnitCostVO } from '../../src/domain/value-objects/unit-cost.vo';
import { MoneyVO } from '../../src/domain/value-objects/money.vo';

describe('InventoryMovement Aggregate and MovementLine', () => {
    const integerUOM = {
        unitOfMeasureId: 'uom-unit',
        allowsFraction: false,
        decimalPlaces: 0,
    };

    describe('InventoryMovementLine', () => {
        it('should calculate totalCost as round(quantity * unitCost, 4)', () => {
            const line = InventoryMovementLine.create({
                id: 'line-001',
                movementId: 'mov-001',
                productId: 'prod-001',
                variantId: 'var-001',
                unitOfMeasureId: 'uom-unit',
                allowsFraction: false,
                decimalPlaces: 0,
                quantity: 3,
                unitCost: '10.123456',
            });

            // 3 * 10.123456 = 30.370368 -> rounded to 4 decimals = 30.3704
            expect(line.getTotalCost().getAmount().toFixed(4)).toBe('30.3704');
            expect(line.getVariantId()).toBe('var-001');
        });

        it('should reject creation without variantId', () => {
            expect(() =>
                InventoryMovementLine.create({
                    id: 'line-001',
                    movementId: 'mov-001',
                    productId: 'prod-001',
                    variantId: '',
                    unitOfMeasureId: 'uom-unit',
                    allowsFraction: false,
                    decimalPlaces: 0,
                    quantity: 1,
                    unitCost: '10.000000',
                }),
            ).toThrow(InvalidInventoryMovementException);
        });

        it('should reject rehydration when totalCost does not match quantity * unitCost within tolerance', () => {
            expect(() =>
                InventoryMovementLine.rehydrate({
                    id: 'line-001',
                    movementId: 'mov-001',
                    productId: 'prod-001',
                    variantId: 'var-001',
                    unitOfMeasureId: 'uom-unit',
                    allowsFraction: false,
                    decimalPlaces: 0,
                    currency: 'COP',
                    quantity: QuantityVO.create(2, integerUOM),
                    unitCost: UnitCostVO.create('10.000000'),
                    totalCost: MoneyVO.create('999.0000', 'COP'), // gross mismatch
                    createdAt: new Date(),
                }),
            ).toThrow(InvalidInventoryMovementException);
        });
    });

    describe('InventoryMovement Aggregate', () => {
        const createValidMovement = () => {
            const line = InventoryMovementLine.create({
                id: 'line-001',
                movementId: 'mov-001',
                productId: 'prod-001',
                variantId: 'var-001',
                unitOfMeasureId: 'uom-unit',
                allowsFraction: false,
                decimalPlaces: 0,
                quantity: 5,
                unitCost: '20.000000',
            });

            return InventoryMovement.create({
                id: 'mov-001',
                tenantId: 'tenant-123',
                warehouseId: 'wh-main',
                type: MovementType.PURCHASE_RECEIPT,
                source: MovementSource.PURCHASE,
                reference: MovementReferenceVO.create(
                    ReferenceType.PURCHASE,
                    'PO-2026-001',
                ),
                occurredAt: new Date(),
                lines: [line],
            });
        };

        it('should create valid POSTED movement with lines and correct totalValue', () => {
            const movement = createValidMovement();

            expect(movement.getStatus()).toBe(MovementStatus.POSTED);
            expect(movement.isPosted()).toBe(true);
            expect(movement.getLines()).toHaveLength(1);
            expect(movement.isInbound()).toBe(true);
            expect(movement.isOutbound()).toBe(false);
        });

        it('should reject movement without lines', () => {
            expect(() =>
                InventoryMovement.create({
                    id: 'mov-002',
                    tenantId: 'tenant-123',
                    warehouseId: 'wh-main',
                    type: MovementType.PURCHASE_RECEIPT,
                    source: MovementSource.PURCHASE,
                    reference: MovementReferenceVO.create(
                        ReferenceType.PURCHASE,
                        'PO-2026-002',
                    ),
                    occurredAt: new Date(),
                    lines: [],
                }),
            ).toThrow(InvalidInventoryMovementException);
        });

        it('should reverse a POSTED movement with reversal movement reference', () => {
            const movement = createValidMovement();

            movement.markAsReversed('mov-rev-001');

            expect(movement.getStatus()).toBe(MovementStatus.REVERSED);
            expect(movement.isReversed()).toBe(true);
            expect(movement.getReversalMovementId()).toBe('mov-rev-001');
            expect(movement.getReversedAt()).toBeDefined();
        });

        it('should reject double reversal', () => {
            const movement = createValidMovement();
            movement.markAsReversed('mov-rev-001');

            expect(() =>
                movement.markAsReversed('mov-rev-002'),
            ).toThrow(InvalidInventoryMovementException);
        });
    });
});
