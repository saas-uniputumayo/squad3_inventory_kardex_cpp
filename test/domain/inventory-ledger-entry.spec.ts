import Decimal from 'decimal.js';
import { InventoryLedgerEntry } from '../../src/domain/entities/inventory-ledger-entry/entity';
import { InvalidInventoryLedgerEntryException } from '../../src/domain/exceptions/invalid-inventory-ledger-entry.exception';
import {
    MovementSource,
    MovementType,
    ReferenceType,
} from '../../src/domain/types';
import { MovementReferenceVO } from '../../src/domain/value-objects/movement-reference.vo';
import { QuantityVO } from '../../src/domain/value-objects/quantity.vo';
import { UnitCostVO } from '../../src/domain/value-objects/unit-cost.vo';
import { MoneyVO } from '../../src/domain/value-objects/money.vo';

describe('InventoryLedgerEntry Immutable Kardex Record', () => {
    const integerUOM = {
        unitOfMeasureId: 'uom-unit',
        allowsFraction: false,
        decimalPlaces: 0,
    };

    const baseProps = {
        id: 'led-001',
        tenantId: 'tenant-123',
        warehouseId: 'wh-main',
        productId: 'prod-001',
        variantId: 'var-001',
        unitOfMeasureId: 'uom-unit',
        movementId: 'mov-001',
        movementLineId: 'line-001',
        movementType: MovementType.PURCHASE_RECEIPT,
        source: MovementSource.PURCHASE,
        reference: MovementReferenceVO.create(
            ReferenceType.PURCHASE,
            'PO-100',
        ),
        unitCost: UnitCostVO.create('50.000000'),
        balanceAverageCost: UnitCostVO.create('50.000000'),
        allowsFraction: false,
        decimalPlaces: 0,
        occurredAt: new Date(),
        sequence: BigInt(1),
    };

    it('should create valid inbound entry with sequence BigInt and precision-aware balance check', () => {
        const entry = InventoryLedgerEntry.create({
            ...baseProps,
            quantityIn: QuantityVO.create(10, integerUOM),
            quantityOut: QuantityVO.create(0, integerUOM),
            totalValue: MoneyVO.create('500.0000', 'COP'),
            balanceQuantity: QuantityVO.create(10, integerUOM),
            balanceValue: MoneyVO.create('500.0000', 'COP'),
        });

        expect(entry.getId()).toBe('led-001');
        expect(entry.getSequence()).toBe(BigInt(1));
        expect(entry.isInbound()).toBe(true);
        expect(entry.isOutbound()).toBe(false);
        expect(entry.getQuantityIn()?.getAmount().toNumber()).toBe(10);
        expect(entry.getTotalValue().getAmount().toFixed(4)).toBe('500.0000');
        expect(entry.getBalanceQuantity().getAmount().toNumber()).toBe(10);
        expect(entry.getBalanceValue().getAmount().toFixed(4)).toBe('500.0000');
    });

    it('should create valid outbound entry', () => {
        const entry = InventoryLedgerEntry.create({
            ...baseProps,
            movementType: MovementType.SALE_DISPATCH,
            source: MovementSource.POS,
            quantityIn: QuantityVO.create(0, integerUOM),
            quantityOut: QuantityVO.create(4, integerUOM),
            totalValue: MoneyVO.create('200.0000', 'COP'),
            balanceQuantity: QuantityVO.create(6, integerUOM),
            balanceValue: MoneyVO.create('300.0000', 'COP'),
        });

        expect(entry.isInbound()).toBe(false);
        expect(entry.isOutbound()).toBe(true);
        expect(entry.getQuantityOut()?.getAmount().toNumber()).toBe(4);
    });

    it('should reject entry where both quantityIn and quantityOut are positive', () => {
        expect(() =>
            InventoryLedgerEntry.create({
                ...baseProps,
                quantityIn: QuantityVO.create(5, integerUOM),
                quantityOut: QuantityVO.create(2, integerUOM),
                totalValue: MoneyVO.create('250.0000', 'COP'),
                balanceQuantity: QuantityVO.create(3, integerUOM),
                balanceValue: MoneyVO.create('150.0000', 'COP'),
            }),
        ).toThrow(InvalidInventoryLedgerEntryException);
    });

    it('should reject entry where both quantityIn and quantityOut are zero', () => {
        expect(() =>
            InventoryLedgerEntry.create({
                ...baseProps,
                quantityIn: QuantityVO.create(0, integerUOM),
                quantityOut: QuantityVO.create(0, integerUOM),
                totalValue: MoneyVO.create('0.0000', 'COP'),
                balanceQuantity: QuantityVO.create(0, integerUOM),
                balanceValue: MoneyVO.create('0.0000', 'COP'),
            }),
        ).toThrow(InvalidInventoryLedgerEntryException);
    });

    it('should reject entry without variantId', () => {
        expect(() =>
            InventoryLedgerEntry.create({
                ...baseProps,
                variantId: '',
                quantityIn: QuantityVO.create(1, integerUOM),
                quantityOut: QuantityVO.create(0, integerUOM),
                totalValue: MoneyVO.create('50.0000', 'COP'),
                balanceQuantity: QuantityVO.create(1, integerUOM),
                balanceValue: MoneyVO.create('50.0000', 'COP'),
            }),
        ).toThrow(InvalidInventoryLedgerEntryException);
    });

    it('should accept balance valuation with repeating decimal (3 units @ 33.333333 = 100.0000)', () => {
        // 3 * 33.333333 = 99.999999. In exact math != 100.0000.
        // Precision-aware validation must accept this within 0.01 tolerance!
        const entry = InventoryLedgerEntry.create({
            ...baseProps,
            unitCost: UnitCostVO.create('33.333333'),
            balanceAverageCost: UnitCostVO.create('33.333333'),
            quantityIn: QuantityVO.create(3, integerUOM),
            quantityOut: QuantityVO.create(0, integerUOM),
            totalValue: MoneyVO.create('100.0000', 'COP'),
            balanceQuantity: QuantityVO.create(3, integerUOM),
            balanceValue: MoneyVO.create('100.0000', 'COP'),
        });

        expect(entry.getBalanceAverageCost().getAmount().toFixed(6)).toBe('33.333333');
    });
});
