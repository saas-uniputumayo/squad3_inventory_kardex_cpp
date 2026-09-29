import Decimal from 'decimal.js';
import { InvalidUnitCostException } from '../exceptions/invalid-unit-cost.exception';
import { InventoryPrecisionPolicy } from '../policy/precision.policy';

export class UnitCostVO {
    private readonly amount: Decimal;
    private readonly currency: string;

    private constructor(amount: Decimal, currency: string) {
        this.amount = amount;
        this.currency = currency;
    }

    static create(
        amount: Decimal.Value,
        currency = 'COP',
    ): UnitCostVO {
        if (amount === undefined || amount === null) {
            throw new InvalidUnitCostException('El costo unitario es obligatorio');
        }

        let value: Decimal;

        try {
            value = new Decimal(amount);
        } catch {
            throw new InvalidUnitCostException('El costo unitario no es válido');
        }

        if (!value.isFinite()) {
            throw new InvalidUnitCostException('El costo unitario debe ser finito');
        }

        if (value.isNegative()) {
            throw new InvalidUnitCostException('El costo unitario no puede ser negativo');
        }

        if (typeof currency !== 'string') {
            throw new InvalidUnitCostException('La moneda debe ser una cadena de texto');
        }

        const normalizedCurrency = currency.trim().toUpperCase();

        if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
            throw new InvalidUnitCostException(
                'La moneda debe utilizar un código ISO de 3 letras',
            );
        }

        // Se redondea a la precisión canónica de 6 decimales para costos de inventario
        const roundedAmount = InventoryPrecisionPolicy.roundUnitCost(value);

        return new UnitCostVO(roundedAmount, normalizedCurrency);
    }

    static zero(currency = 'COP'): UnitCostVO {
        return UnitCostVO.create(0, currency);
    }

    /**
     * Multiplica el costo unitario por una cantidad,
     * retornando el valor total de inventario redondeado canónicamente a 4 decimales.
     */
    multiply(quantity: Decimal.Value): Decimal {
        if (quantity === undefined || quantity === null) {
            throw new InvalidUnitCostException(
                'La cantidad utilizada para calcular el costo no es válida',
            );
        }

        let decimalQuantity: Decimal;

        try {
            decimalQuantity = new Decimal(quantity);
        } catch {
            throw new InvalidUnitCostException(
                'La cantidad utilizada para calcular el costo no es válida',
            );
        }

        if (!decimalQuantity.isFinite()) {
            throw new InvalidUnitCostException('La cantidad debe ser finita');
        }

        if (decimalQuantity.isNegative()) {
            throw new InvalidUnitCostException('La cantidad no puede ser negativa');
        }

        const rawTotal = this.amount.mul(decimalQuantity);
        return InventoryPrecisionPolicy.roundInventoryValue(rawTotal);
    }

    isZero(): boolean {
        return this.amount.isZero();
    }

    multiplyByQuantity(quantity: Decimal.Value | { getAmount(): Decimal }): Decimal {
        const val =
            quantity && typeof (quantity as any).getAmount === 'function'
                ? (quantity as any).getAmount()
                : (quantity as Decimal.Value);
        return this.multiply(val);
    }

    equals(other: UnitCostVO): boolean {
        if (!other) {
            return false;
        }

        return (
            this.currency === other.currency &&
            this.amount.eq(other.amount)
        );
    }

    getAmount(): Decimal {
        return this.amount;
    }

    getCurrency(): string {
        return this.currency;
    }

    toString(): string {
        return `${this.amount.toFixed(InventoryPrecisionPolicy.UNIT_COST_DECIMALS)} ${this.currency}`;
    }
}