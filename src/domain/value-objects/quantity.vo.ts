import Decimal from 'decimal.js';
import { InvalidQuantityException } from '../exceptions/invalid-quantity.exception';

export interface QuantityRules {
    unitOfMeasureId: string;
    allowsFraction: boolean;
    decimalPlaces: number;
}

export class QuantityVO {
    private readonly amount: Decimal;
    private readonly unitOfMeasureId: string;
    private readonly rules: QuantityRules;

    private constructor(
        amount: Decimal,
        rules: QuantityRules,
    ) {
        this.amount = amount;
        this.unitOfMeasureId = rules.unitOfMeasureId;
        this.rules = {
            unitOfMeasureId: rules.unitOfMeasureId,
            allowsFraction: rules.allowsFraction,
            decimalPlaces: rules.decimalPlaces,
        };
    }

    static create(
        amount: Decimal.Value,
        rules: QuantityRules,
    ): QuantityVO {
        const normalizedRules =
            QuantityVO.normalizeRules(rules);

        let decimal: Decimal;

        try {
            decimal = new Decimal(amount);
        } catch {
            throw new InvalidQuantityException(
                'La cantidad debe ser un valor numérico válido',
            );
        }

        if (!decimal.isFinite()) {
            throw new InvalidQuantityException(
                'La cantidad debe ser un valor finito',
            );
        }

        if (decimal.isNegative()) {
            throw new InvalidQuantityException(
                'La cantidad no puede ser negativa',
            );
        }

        QuantityVO.validatePrecision(
            decimal,
            normalizedRules,
        );

        return new QuantityVO(
            decimal,
            normalizedRules,
        );
    }

    static zero(
        rules: QuantityRules,
    ): QuantityVO {
        return QuantityVO.create(
            0,
            rules,
        );
    }

    add(other: QuantityVO): QuantityVO {
        this.ensureCompatibleQuantity(other);

        return QuantityVO.create(
            this.amount.plus(other.amount),
            this.rules,
        );
    }

    subtract(other: QuantityVO): QuantityVO {
        this.ensureCompatibleQuantity(other);

        const result = this.amount.minus(
            other.amount,
        );

        if (result.isNegative()) {
            throw new InvalidQuantityException(
                'El resultado de la cantidad no puede ser negativo',
            );
        }

        return QuantityVO.create(
            result,
            this.rules,
        );
    }

    multiply(
        multiplier: Decimal.Value,
    ): QuantityVO {
        let decimalMultiplier: Decimal;

        try {
            decimalMultiplier = new Decimal(
                multiplier,
            );
        } catch {
            throw new InvalidQuantityException(
                'El multiplicador debe ser un valor numérico válido',
            );
        }

        if (!decimalMultiplier.isFinite()) {
            throw new InvalidQuantityException(
                'El multiplicador debe ser finito',
            );
        }

        if (decimalMultiplier.isNegative()) {
            throw new InvalidQuantityException(
                'El multiplicador no puede ser negativo',
            );
        }

        const result =
            this.amount.mul(decimalMultiplier);

        if (!result.isFinite()) {
            throw new InvalidQuantityException(
                'El resultado de la cantidad debe ser finito',
            );
        }

        return QuantityVO.create(
            result,
            this.rules,
        );
    }

    isZero(): boolean {
        return this.amount.isZero();
    }

    isPositive(): boolean {
        return this.amount.greaterThan(0);
    }

    isGreaterThan(
        other: QuantityVO,
    ): boolean {
        this.ensureCompatibleQuantity(other);

        return this.amount.greaterThan(
            other.amount,
        );
    }

    isGreaterThanOrEqual(
        other: QuantityVO,
    ): boolean {
        this.ensureCompatibleQuantity(other);

        return this.amount.greaterThanOrEqualTo(
            other.amount,
        );
    }

    isLessThan(
        other: QuantityVO,
    ): boolean {
        this.ensureCompatibleQuantity(other);

        return this.amount.lessThan(
            other.amount,
        );
    }

    isLessThanOrEqual(
        other: QuantityVO,
    ): boolean {
        this.ensureCompatibleQuantity(other);

        return this.amount.lessThanOrEqualTo(
            other.amount,
        );
    }

    equals(other: QuantityVO): boolean {
        return (
            this.unitOfMeasureId ===
            other.unitOfMeasureId &&
            this.amount.eq(other.amount)
        );
    }

    getAmount(): Decimal {
        return this.amount;
    }

    getUnitOfMeasureId(): string {
        return this.unitOfMeasureId;
    }

    getAllowsFraction(): boolean {
        return this.rules.allowsFraction;
    }

    getDecimalPlaces(): number {
        return this.rules.decimalPlaces;
    }

    toString(): string {
        return `${this.amount.toString()} ${this.unitOfMeasureId}`;
    }

    private ensureCompatibleQuantity(
        other: QuantityVO,
    ): void {
        if (
            this.unitOfMeasureId !==
            other.unitOfMeasureId
        ) {
            throw new InvalidQuantityException(
                'No se pueden operar cantidades con unidades de medida diferentes',
            );
        }

        if (
            this.rules.allowsFraction !==
            other.rules.allowsFraction
        ) {
            throw new InvalidQuantityException(
                'No se pueden operar cantidades con reglas de fraccionamiento diferentes',
            );
        }

        if (
            this.rules.decimalPlaces !==
            other.rules.decimalPlaces
        ) {
            throw new InvalidQuantityException(
                'No se pueden operar cantidades con precisiones decimales diferentes',
            );
        }
    }

    private static normalizeRules(
        rules: QuantityRules,
    ): QuantityRules {
        const unitOfMeasureId =
            rules.unitOfMeasureId.trim();

        if (!unitOfMeasureId) {
            throw new InvalidQuantityException(
                'La cantidad debe tener una unidad de medida',
            );
        }

        if (
            typeof rules.allowsFraction !==
            'boolean'
        ) {
            throw new InvalidQuantityException(
                'La configuración de fraccionamiento de la unidad no es válida',
            );
        }

        if (
            !Number.isInteger(
                rules.decimalPlaces,
            )
        ) {
            throw new InvalidQuantityException(
                'Las posiciones decimales deben ser un número entero',
            );
        }

        if (rules.decimalPlaces < 0) {
            throw new InvalidQuantityException(
                'Las posiciones decimales no pueden ser negativas',
            );
        }

        if (
            !rules.allowsFraction &&
            rules.decimalPlaces !== 0
        ) {
            throw new InvalidQuantityException(
                'Una unidad que no permite fracciones debe tener cero posiciones decimales',
            );
        }

        return {
            unitOfMeasureId,
            allowsFraction:
                rules.allowsFraction,
            decimalPlaces:
                rules.decimalPlaces,
        };
    }

    private static validatePrecision(
        value: Decimal,
        rules: QuantityRules,
    ): void {
        if (
            !rules.allowsFraction &&
            !value.isInteger()
        ) {
            throw new InvalidQuantityException(
                `La unidad ${rules.unitOfMeasureId} no permite cantidades fraccionarias`,
            );
        }

        const decimalPlaces =
            QuantityVO.countDecimalPlaces(value);

        if (
            decimalPlaces >
            rules.decimalPlaces
        ) {
            throw new InvalidQuantityException(
                `La cantidad para ${rules.unitOfMeasureId} admite máximo ${rules.decimalPlaces} posiciones decimales`,
            );
        }
    }

    private static countDecimalPlaces(
        value: Decimal,
    ): number {
        const fixed = value.toFixed();

        const decimalSeparator =
            fixed.indexOf('.');

        if (decimalSeparator === -1) {
            return 0;
        }

        return (
            fixed.length -
            decimalSeparator -
            1
        );
    }
}