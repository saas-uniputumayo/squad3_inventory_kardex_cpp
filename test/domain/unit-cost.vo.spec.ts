import Decimal from 'decimal.js';
import { InvalidUnitCostException } from '../../src/domain/exceptions/invalid-unit-cost.exception';
import { UnitCostVO } from '../../src/domain/value-objects/unit-cost.vo';

describe('UnitCostVO', () => {
    describe('Creation and Precision', () => {
        it('should allow zero cost', () => {
            const cost = UnitCostVO.create(0);
            expect(cost.isZero()).toBe(true);
            expect(cost.getAmount().toFixed(6)).toBe('0.000000');
        });

        it('should round input to 6 decimal places', () => {
            const cost = UnitCostVO.create(10.1234567);
            expect(cost.getAmount().toString()).toBe('10.123457');
        });

        it('should reject negative unit costs', () => {
            expect(() => UnitCostVO.create(-0.01)).toThrow(
                InvalidUnitCostException,
            );
        });

        it('should accept Decimal, number, and string inputs', () => {
            const fromNum = UnitCostVO.create(25.5);
            const fromStr = UnitCostVO.create('25.5');
            const fromDec = UnitCostVO.create(new Decimal('25.5'));

            expect(fromNum.equals(fromStr)).toBe(true);
            expect(fromNum.equals(fromDec)).toBe(true);
        });

        it('should reject invalid non-numeric inputs', () => {
            expect(() => UnitCostVO.create('invalid')).toThrow(
                InvalidUnitCostException,
            );
            expect(() => UnitCostVO.create(NaN)).toThrow(
                InvalidUnitCostException,
            );
        });
    });

    describe('Multiplication for Inventory Valuation (4 decimals)', () => {
        it('should multiply quantity and round total value to 4 decimal places', () => {
            const unitCost = UnitCostVO.create('10.123456');
            const qty = new Decimal('3');
            const totalVal = unitCost.multiplyByQuantity(qty);

            // 10.123456 * 3 = 30.370368 -> rounded to 4 decimals = 30.3704
            expect(totalVal.toString()).toBe('30.3704');
        });

        it('should handle fractional quantities without floating point precision issues', () => {
            const unitCost = UnitCostVO.create('19.990000');
            const qty = new Decimal('0.333');
            const totalVal = unitCost.multiplyByQuantity(qty);

            // 19.99 * 0.333 = 6.65667 -> rounded to 4 decimals = 6.6567
            expect(totalVal.toString()).toBe('6.6567');
        });
    });
});
