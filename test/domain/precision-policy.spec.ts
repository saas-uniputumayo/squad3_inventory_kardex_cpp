import Decimal from 'decimal.js';
import { InventoryPrecisionPolicy } from '../../src/domain/policy/precision.policy';

describe('InventoryPrecisionPolicy', () => {
    describe('roundQuantity', () => {
        it('should round to specified decimals using ROUND_HALF_UP', () => {
            const result = InventoryPrecisionPolicy.roundQuantity(new Decimal('1.23456'), 2);
            expect(result.toString()).toBe('1.23');

            const roundUp = InventoryPrecisionPolicy.roundQuantity(new Decimal('1.235'), 2);
            expect(roundUp.toString()).toBe('1.24');
        });

        it('should round to 0 decimals for integer quantities', () => {
            const result = InventoryPrecisionPolicy.roundQuantity(new Decimal('5.6'), 0);
            expect(result.toString()).toBe('6');
        });
    });

    describe('roundUnitCost (6 decimals)', () => {
        it('should round to 6 decimals', () => {
            const raw = new Decimal('10.123456789');
            const rounded = InventoryPrecisionPolicy.roundUnitCost(raw);
            expect(rounded.toString()).toBe('10.123457');
        });

        it('should preserve exactly 6 decimals', () => {
            const raw = new Decimal('15.5');
            const rounded = InventoryPrecisionPolicy.roundUnitCost(raw);
            expect(rounded.toFixed(6)).toBe('15.500000');
        });
    });

    describe('roundInventoryValue (4 decimals)', () => {
        it('should round to 4 decimals', () => {
            const raw = new Decimal('100.123456');
            const rounded = InventoryPrecisionPolicy.roundInventoryValue(raw);
            expect(rounded.toString()).toBe('100.1235');
        });

        it('should preserve exactly 4 decimals', () => {
            const raw = new Decimal('250');
            const rounded = InventoryPrecisionPolicy.roundInventoryValue(raw);
            expect(rounded.toFixed(4)).toBe('250.0000');
        });
    });

    describe('areValuesEquivalent with canonical 4-decimal tolerance (0.0001)', () => {
        it('should accept differences within the canonical 0.0001 step', () => {
            const a = new Decimal('100.0000');
            const b = new Decimal('99.9999'); // diff = 0.0001
            expect(InventoryPrecisionPolicy.areValuesEquivalent(a, b)).toBe(true);
        });

        it('should reject differences exceeding the canonical 0.0001 step (e.g. 0.0002)', () => {
            const a = new Decimal('100.0000');
            const b = new Decimal('99.9998'); // diff = 0.0002 > 0.0001
            expect(InventoryPrecisionPolicy.areValuesEquivalent(a, b)).toBe(false);
        });

        it('should reject corrupt states that the old arbitrary 0.01 tolerance would have erroneously accepted', () => {
            const a = new Decimal('100.0000');
            const corrupt = new Decimal('100.0050'); // diff = 0.0050 (50 ticks off)
            expect(InventoryPrecisionPolicy.areValuesEquivalent(a, corrupt)).toBe(false);
        });
    });

    describe('calculateValuationTolerance (Derived Precision Math)', () => {
        it('for small quantity (Q=3): should accept valid rounding delta but reject errors', () => {
            const qty = 3;
            const tolerance = InventoryPrecisionPolicy.calculateValuationTolerance(qty);

            // Derived tolerance: 3 * 0.0000005 + 0.0001 = 0.0001015
            expect(tolerance.toNumber()).toBeCloseTo(0.0001015, 6);

            const expected = new Decimal('99.999999'); // 3 * 33.333333
            const actual = new Decimal('100.0000'); // stored inventory value
            // diff = 0.000001 <= 0.0001015 -> VALID
            expect(InventoryPrecisionPolicy.areValuesEquivalent(expected, actual, tolerance)).toBe(true);

            // An invalid state with error 0.0010 (> tolerance) must be REJECTED:
            const invalidActual = new Decimal('100.0010');
            expect(InventoryPrecisionPolicy.areValuesEquivalent(expected, invalidActual, tolerance)).toBe(false);
        });

        it('for large quantity (Q=100,000): should accept cumulative CPP rounding residue but reject corrupt drift', () => {
            const qty = 100000;
            const tolerance = InventoryPrecisionPolicy.calculateValuationTolerance(qty);

            // Derived tolerance: 100,000 * 0.0000005 + 0.0001 = 0.0501
            expect(tolerance.toNumber()).toBe(0.0501);

            // Real case: 100,000 units with non-terminating CPP (10 / 3 = 3.333333)
            // expected = 100,000 * 3.333333 = 333,333.3000
            // stored book value = 333,333.3333
            // diff = 0.0333 <= 0.0501 -> VALID (inherent CPP rounding truncation)
            const expected = new Decimal('333333.3000');
            const actual = new Decimal('333333.3333');
            expect(InventoryPrecisionPolicy.areValuesEquivalent(expected, actual, tolerance)).toBe(true);

            // An error exceeding the derived threshold (e.g. diff = 0.0800 > 0.0501) must be REJECTED:
            const corrupt = new Decimal('333333.3900');
            expect(InventoryPrecisionPolicy.areValuesEquivalent(expected, corrupt, tolerance)).toBe(false);
        });
    });

    describe('Floating-point hazards avoided with Decimal.js', () => {
        it('0.1 + 0.2 must equal 0.3 without binary floating point drift', () => {
            // In native JS float: 0.1 + 0.2 = 0.30000000000000004
            const jsFloat = 0.1 + 0.2;
            expect(jsFloat === 0.3).toBe(false);

            const dec = new Decimal('0.1').plus(new Decimal('0.2'));
            expect(dec.equals(new Decimal('0.3'))).toBe(true);
            expect(dec.toString()).toBe('0.3');
        });
    });
});
