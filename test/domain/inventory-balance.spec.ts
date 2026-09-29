import Decimal from 'decimal.js';
import { InventoryBalance } from '../../src/domain/entities/inventory-balance/entity';
import { InvalidInventoryBalanceException } from '../../src/domain/exceptions/invalid-inventory-balance.exception';
import { MoneyVO } from '../../src/domain/value-objects/money.vo';
import { QuantityVO } from '../../src/domain/value-objects/quantity.vo';
import { UnitCostVO } from '../../src/domain/value-objects/unit-cost.vo';

describe('InventoryBalance Aggregate', () => {
    const integerUOM = {
        unitOfMeasureId: 'uom-unit',
        allowsFraction: false,
        decimalPlaces: 0,
    };

    const baseProps = {
        id: 'bal-001',
        tenantId: 'tenant-123',
        warehouseId: 'wh-main',
        productId: 'prod-001',
        variantId: 'var-001',
        unitOfMeasureId: 'uom-unit',
        allowsFraction: false,
        decimalPlaces: 0,
        currency: 'COP',
    };

    describe('Creation', () => {
        it('should initialize empty balance with zero quantity, averageCost, and inventoryValue', () => {
            const balance = InventoryBalance.create(baseProps);

            expect(balance.getQuantity().getAmount().toNumber()).toBe(0);
            expect(balance.getReservedQuantity().getAmount().toNumber()).toBe(0);
            expect(balance.getAvailableQuantity().getAmount().toNumber()).toBe(0);
            expect(balance.getAverageCost().getAmount().toNumber()).toBe(0);
            expect(balance.getInventoryValue().getAmount().toNumber()).toBe(0);
        });

        it('should reject creation without variantId', () => {
            expect(() =>
                InventoryBalance.create({
                    ...baseProps,
                    variantId: '',
                }),
            ).toThrow(InvalidInventoryBalanceException);
        });
    });

    describe('Receive operations & CPP Calculation', () => {
        it('should calculate initial receive correctly', () => {
            const balance = InventoryBalance.create(baseProps);
            const qty = QuantityVO.create(10, integerUOM);
            const cost = UnitCostVO.create('50.000000');

            balance.receive(qty, cost);

            expect(balance.getQuantity().getAmount().toNumber()).toBe(10);
            expect(balance.getInventoryValue().getAmount().toFixed(4)).toBe('500.0000');
            expect(balance.getAverageCost().getAmount().toFixed(6)).toBe('50.000000');
        });

        it('should calculate weighted average cost (CPP) on second receive', () => {
            const balance = InventoryBalance.create(baseProps);
            // Receive 10 units @ 50.000000 = $500.0000
            balance.receive(QuantityVO.create(10, integerUOM), UnitCostVO.create('50.000000'));

            // Receive 20 units @ 80.000000 = $1600.0000
            // Total val = 500 + 1600 = $2100.0000
            // Total qty = 30
            // New CPP = 2100 / 30 = 70.000000
            balance.receive(QuantityVO.create(20, integerUOM), UnitCostVO.create('80.000000'));

            expect(balance.getQuantity().getAmount().toNumber()).toBe(30);
            expect(balance.getInventoryValue().getAmount().toFixed(4)).toBe('2100.0000');
            expect(balance.getAverageCost().getAmount().toFixed(6)).toBe('70.000000');
        });

        it('SECTION 32 TEST: Non-terminating decimal CPP calculation', () => {
            // Existencia: 3, CPP: 10.123456
            // Valor existente: round(3 * 10.123456, 4) = 30.3704
            // Entrada: 2, costo: 20.654321
            // Valor recibido: round(2 * 20.654321, 4) = 41.3086
            // Nuevo valor: 30.3704 + 41.3086 = 71.6790
            // Nueva cantidad: 5
            // Nuevo CPP: round(71.6790 / 5, 6) = 14.335800
            const balance = InventoryBalance.rehydrate({
                id: 'bal-002',
                tenantId: 'tenant-123',
                warehouseId: 'wh-main',
                productId: 'prod-001',
                variantId: 'var-001',
                unitOfMeasureId: 'uom-unit',
                allowsFraction: false,
                decimalPlaces: 0,
                currency: 'COP',
                quantityOnHand: QuantityVO.create(3, integerUOM),
                reservedQuantity: QuantityVO.create(0, integerUOM),
                averageCost: UnitCostVO.create('10.123456'),
                inventoryValue: MoneyVO.create('30.3704', 'COP'),
                version: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            balance.receive(
                QuantityVO.create(2, integerUOM),
                UnitCostVO.create('20.654321'),
            );

            expect(balance.getQuantity().getAmount().toNumber()).toBe(5);
            expect(balance.getInventoryValue().getAmount().toFixed(4)).toBe('71.6790');
            expect(balance.getAverageCost().getAmount().toFixed(6)).toBe('14.335800');
        });

        it('Repeating decimal CPP calculation (100 value / 3 units)', () => {
            const balance = InventoryBalance.create(baseProps);
            // 3 units @ 33.333333 = $100.0000
            balance.receive(
                QuantityVO.create(3, integerUOM),
                UnitCostVO.create('33.333333'),
            );

            expect(balance.getQuantity().getAmount().toNumber()).toBe(3);
            expect(balance.getInventoryValue().getAmount().toFixed(4)).toBe('100.0000');
            expect(balance.getAverageCost().getAmount().toFixed(6)).toBe('33.333333');
        });
    });

    describe('Dispatch operations', () => {
        let balance: InventoryBalance;

        beforeEach(() => {
            balance = InventoryBalance.create(baseProps);
            // 10 units @ 100.000000 = $1000.0000
            balance.receive(
                QuantityVO.create(10, integerUOM),
                UnitCostVO.create('100.000000'),
            );
        });

        it('should dispatch partial quantity and preserve CPP', () => {
            // Dispatch 4 units
            // Dispatch value: 4 * 100.000000 = 400.0000
            // Remaining: 6 units, $600.0000, CPP = 100.000000
            const dispatchValue = balance.dispatch(QuantityVO.create(4, integerUOM));

            expect(dispatchValue.getAmount().toFixed(4)).toBe('400.0000');
            expect(balance.getQuantity().getAmount().toNumber()).toBe(6);
            expect(balance.getInventoryValue().getAmount().toFixed(4)).toBe('600.0000');
            expect(balance.getAverageCost().getAmount().toFixed(6)).toBe('100.000000');
        });

        it('should dispatch all stock and reset CPP and inventoryValue to 0', () => {
            // Dispatch all 10 units
            const dispatchValue = balance.dispatch(QuantityVO.create(10, integerUOM));

            expect(dispatchValue.getAmount().toFixed(4)).toBe('1000.0000');
            expect(balance.getQuantity().getAmount().toNumber()).toBe(0);
            expect(balance.getInventoryValue().getAmount().toNumber()).toBe(0);
            expect(balance.getAverageCost().getAmount().toNumber()).toBe(0);
        });

        it('should reject dispatching more than available stock', () => {
            expect(() =>
                balance.dispatch(QuantityVO.create(11, integerUOM)),
            ).toThrow(InvalidInventoryBalanceException);
        });

        it('should respect reservedQuantity on dispatch', () => {
            // Reserve 4 units -> Available = 6 units
            balance.reserve(QuantityVO.create(4, integerUOM));
            expect(balance.getAvailableQuantity().getAmount().toNumber()).toBe(6);

            // Attempting to dispatch 7 units must fail because only 6 are unreserved
            expect(() =>
                balance.dispatch(QuantityVO.create(7, integerUOM)),
            ).toThrow(InvalidInventoryBalanceException);

            // Dispatch 6 unreserved units succeeds
            balance.dispatch(QuantityVO.create(6, integerUOM));
            expect(balance.getQuantity().getAmount().toNumber()).toBe(4);
            expect(balance.getReservedQuantity().getAmount().toNumber()).toBe(4);
            expect(balance.getAvailableQuantity().getAmount().toNumber()).toBe(0);
        });
    });

    describe('Adjust operations', () => {
        it('should adjust to new positive quantity and new inventory value, deriving new CPP', () => {
            const balance = InventoryBalance.create(baseProps);
            // Adjust to 8 units with total value $800.0000 -> CPP = 100.000000
            balance.adjust(
                QuantityVO.create(8, integerUOM),
                MoneyVO.create('800.0000', 'COP'),
            );

            expect(balance.getQuantity().getAmount().toNumber()).toBe(8);
            expect(balance.getInventoryValue().getAmount().toFixed(4)).toBe('800.0000');
            expect(balance.getAverageCost().getAmount().toFixed(6)).toBe('100.000000');
        });

        it('should adjust to zero quantity and reset value and CPP to 0', () => {
            const balance = InventoryBalance.create(baseProps);
            balance.receive(QuantityVO.create(5, integerUOM), UnitCostVO.create('10.000000'));

            // Adjust to 0 units
            balance.adjust(
                QuantityVO.create(0, integerUOM),
                MoneyVO.create('0', 'COP'),
            );

            expect(balance.getQuantity().getAmount().toNumber()).toBe(0);
            expect(balance.getInventoryValue().getAmount().toNumber()).toBe(0);
            expect(balance.getAverageCost().getAmount().toNumber()).toBe(0);
        });

        it('should reject adjusting to zero quantity with positive inventory value', () => {
            const balance = InventoryBalance.create(baseProps);
            expect(() =>
                balance.adjust(
                    QuantityVO.create(0, integerUOM),
                    MoneyVO.create('100.0000', 'COP'),
                ),
            ).toThrow(InvalidInventoryBalanceException);
        });
    });

    describe('Reservations', () => {
        it('should reserve and release quantities', () => {
            const balance = InventoryBalance.create(baseProps);
            balance.receive(QuantityVO.create(10, integerUOM), UnitCostVO.create('20.000000'));

            balance.reserve(QuantityVO.create(3, integerUOM));
            expect(balance.getReservedQuantity().getAmount().toNumber()).toBe(3);
            expect(balance.getAvailableQuantity().getAmount().toNumber()).toBe(7);

            balance.release(QuantityVO.create(2, integerUOM));
            expect(balance.getReservedQuantity().getAmount().toNumber()).toBe(1);
            expect(balance.getAvailableQuantity().getAmount().toNumber()).toBe(9);
        });

        it('should reject releasing more than reserved', () => {
            const balance = InventoryBalance.create(baseProps);
            balance.receive(QuantityVO.create(10, integerUOM), UnitCostVO.create('20.000000'));
            balance.reserve(QuantityVO.create(2, integerUOM));

            expect(() =>
                balance.release(QuantityVO.create(3, integerUOM)),
            ).toThrow(InvalidInventoryBalanceException);
        });
    });
});
