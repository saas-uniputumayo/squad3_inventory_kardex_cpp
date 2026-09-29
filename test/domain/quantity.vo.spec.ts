import Decimal from 'decimal.js';
import { InvalidQuantityException } from '../../src/domain/exceptions/invalid-quantity.exception';
import { QuantityVO } from '../../src/domain/value-objects/quantity.vo';

describe('QuantityVO', () => {
    const integerUOM = {
        unitOfMeasureId: 'uom-unit',
        allowsFraction: false,
        decimalPlaces: 0,
    };

    const fractionalUOM = {
        unitOfMeasureId: 'uom-kg',
        allowsFraction: true,
        decimalPlaces: 3,
    };

    describe('Creation with Integer UOM', () => {
        it('should allow valid zero integer', () => {
            const qty = QuantityVO.create(0, integerUOM);
            expect(qty.getAmount().toNumber()).toBe(0);
            expect(qty.isZero()).toBe(true);
        });

        it('should allow valid positive integer', () => {
            const qty = QuantityVO.create(10, integerUOM);
            expect(qty.getAmount().toNumber()).toBe(10);
            expect(qty.isPositive()).toBe(true);
        });

        it('should reject fractions when allowsFraction is false', () => {
            expect(() => QuantityVO.create(10.5, integerUOM)).toThrow(
                InvalidQuantityException,
            );
        });

        it('should reject negative quantities for inventory stocks', () => {
            expect(() => QuantityVO.create(-1, integerUOM)).toThrow(
                InvalidQuantityException,
            );
        });
    });

    describe('Creation with Fractional UOM', () => {
        it('should allow decimals within allowed decimal places', () => {
            const qty = QuantityVO.create(12.345, fractionalUOM);
            expect(qty.getAmount().toString()).toBe('12.345');
        });

        it('should reject decimals exceeding allowed decimal places', () => {
            expect(() => QuantityVO.create(12.3456, fractionalUOM)).toThrow(
                InvalidQuantityException,
            );
        });

        it('should reject negative fractional quantities', () => {
            expect(() => QuantityVO.create(-0.001, fractionalUOM)).toThrow(
                InvalidQuantityException,
            );
        });

        it('should accept Decimal instances as input', () => {
            const dec = new Decimal('5.25');
            const qty = QuantityVO.create(dec, fractionalUOM);
            expect(qty.getAmount().toString()).toBe('5.25');
        });
    });

    describe('Arithmetic operations', () => {
        it('should add quantities with identical UOM rules', () => {
            const a = QuantityVO.create(10, integerUOM);
            const b = QuantityVO.create(5, integerUOM);
            const sum = a.add(b);
            expect(sum.getAmount().toNumber()).toBe(15);
        });

        it('should subtract quantities when result >= 0', () => {
            const a = QuantityVO.create(10, integerUOM);
            const b = QuantityVO.create(4, integerUOM);
            const diff = a.subtract(b);
            expect(diff.getAmount().toNumber()).toBe(6);
        });

        it('should reject subtract when result would be negative', () => {
            const a = QuantityVO.create(5, integerUOM);
            const b = QuantityVO.create(10, integerUOM);
            expect(() => a.subtract(b)).toThrow(InvalidQuantityException);
        });

        it('should reject operations between different UOMs', () => {
            const a = QuantityVO.create(10, integerUOM);
            const b = QuantityVO.create(5, fractionalUOM);
            expect(() => a.add(b)).toThrow(InvalidQuantityException);
        });
    });
});
