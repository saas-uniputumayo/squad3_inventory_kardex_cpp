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
        if (amount === undefined || amount === null) {
            throw new InvalidMoneyException('El valor monetario es obligatorio');
        }

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

        if (typeof currency !== 'string') {
            throw new InvalidMoneyException(
                'La moneda debe ser una cadena de texto',
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

    static zero(currency = 'COP'): MoneyVO {
        return MoneyVO.create(0, currency);
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
        if (multiplier === undefined || multiplier === null) {
            throw new InvalidMoneyException('El multiplicador es obligatorio');
        }

        let decimalMultiplier: Decimal;

        try {
            decimalMultiplier = new Decimal(multiplier);
        } catch {
            throw new InvalidMoneyException('El multiplicador no es válido');
        }

        if (!decimalMultiplier.isFinite()) {
            throw new InvalidMoneyException('El multiplicador debe ser finito');
        }

        if (decimalMultiplier.isNegative()) {
            throw new InvalidMoneyException('El multiplicador no puede ser negativo');
        }

        return MoneyVO.create(
            this.amount.mul(decimalMultiplier),
            this.currency,
        );
    }

    equals(other: MoneyVO): boolean {
        if (!other) {
            return false;
        }

        return (
            this.currency === other.currency &&
            this.amount.eq(other.amount)
        );
    }

    toString(): string {
        return `${this.amount.toString()} ${this.currency}`;
    }

    private ensureSameCurrency(other: MoneyVO): void {
        if (!other || this.currency !== other.currency) {
            throw new InvalidMoneyException(
                'No se pueden operar monedas diferentes',
            );
        }
    }
}