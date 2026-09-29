import Decimal from 'decimal.js';

import { InvalidMoneyException } from '../exceptions/invalid-money.exception';

export class MoneyVO {
    private readonly amount: Decimal;
    private readonly currency: string;

    private constructor(amount: Decimal, currency: string) {
        this.amount = amount;
        this.currency = currency;
    }

    static create(
        amount: Decimal.Value,
        currency = 'COP',
    ): MoneyVO {
        let value: Decimal;

        try {
            value = new Decimal(amount);
        } catch {
            throw new InvalidMoneyException(
                'El valor monetario no es válido',
            );
        }

        if (!value.isFinite()) {
            throw new InvalidMoneyException(
                'El valor monetario debe ser finito',
            );
        }

        if (value.isNegative()) {
            throw new InvalidMoneyException(
                'El valor monetario no puede ser negativo',
            );
        }

        const normalizedCurrency = currency.trim().toUpperCase();

        if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
            throw new InvalidMoneyException(
                'La moneda debe utilizar un código ISO de 3 letras',
            );
        }

        return new MoneyVO(value, normalizedCurrency);
    }

    getAmount(): Decimal {
        return this.amount;
    }

    getCurrency(): string {
        return this.currency;
    }

    add(other: MoneyVO): MoneyVO {
        this.ensureSameCurrency(other);

        return MoneyVO.create(
            this.amount.plus(other.amount),
            this.currency,
        );
    }

    subtract(other: MoneyVO): MoneyVO {
        this.ensureSameCurrency(other);

        const result = this.amount.minus(other.amount);

        if (result.isNegative()) {
            throw new InvalidMoneyException(
                'El resultado monetario no puede ser negativo',
            );
        }

        return MoneyVO.create(result, this.currency);
    }

    multiply(multiplier: Decimal.Value): MoneyVO {
        return MoneyVO.create(
            this.amount.mul(multiplier),
            this.currency,
        );
    }

    equals(other: MoneyVO): boolean {
        return (
            this.currency === other.currency &&
            this.amount.eq(other.amount)
        );
    }

    toString(): string {
        return `${this.amount.toFixed(2)} ${this.currency}`;
    }

    private ensureSameCurrency(other: MoneyVO): void {
        if (this.currency !== other.currency) {
            throw new InvalidMoneyException(
                'No se pueden operar monedas diferentes',
            );
        }
    }
}