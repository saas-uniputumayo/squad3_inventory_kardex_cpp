import Decimal from 'decimal.js';

import { InvalidMoneyException } from '../exceptions/invalid-money.exception';

export class UnitCostVO {
    private readonly amount: Decimal;
    private readonly currency: string;

    private constructor(
        amount: Decimal,
        currency: string,
    ) {
        this.amount = amount;
        this.currency = currency;
    }

    static create(
        amount: Decimal.Value,
        currency = 'COP',
    ): UnitCostVO {
        let value: Decimal;

        try {
            value = new Decimal(amount);
        } catch {
            throw new InvalidMoneyException(
                'El costo unitario no es válido',
            );
        }

        if (!value.isFinite()) {
            throw new InvalidMoneyException(
                'El costo unitario debe ser finito',
            );
        }

        if (value.isNegative()) {
            throw new InvalidMoneyException(
                'El costo unitario no puede ser negativo',
            );
        }

        const normalizedCurrency =
            currency.trim().toUpperCase();

        if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
            throw new InvalidMoneyException(
                'La moneda debe utilizar un código ISO de 3 letras',
            );
        }

        return new UnitCostVO(
            value,
            normalizedCurrency,
        );
    }

    multiply(
        quantity: Decimal.Value,
    ): Decimal {
        let decimalQuantity: Decimal;

        try {
            decimalQuantity = new Decimal(quantity);
        } catch {
            throw new InvalidMoneyException(
                'La cantidad utilizada para calcular el costo no es válida',
            );
        }

        if (!decimalQuantity.isFinite()) {
            throw new InvalidMoneyException(
                'La cantidad debe ser finita',
            );
        }

        if (decimalQuantity.isNegative()) {
            throw new InvalidMoneyException(
                'La cantidad no puede ser negativa',
            );
        }

        return this.amount.mul(decimalQuantity);
    }

    equals(other: UnitCostVO): boolean {
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
        return `${this.amount.toString()} ${this.currency}`;
    }
}