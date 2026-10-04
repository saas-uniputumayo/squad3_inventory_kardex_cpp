import Decimal from 'decimal.js';
import { Quantity } from './quantity.vo';

export class Cost {
  private readonly amount: Decimal;

  constructor(amount: number | string | Decimal) {
    const dec = new Decimal(amount || 0);
    if (dec.isNegative()) {
      throw new Error('El costo unitario no puede ser negativo.');
    }
    this.amount = dec.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  }

  get value(): number {
    return this.amount.toNumber();
  }

  toNumber(): number {
    return this.amount.toNumber();
  }

  get decimal(): Decimal {
    return this.amount;
  }

  toString(): string {
    return this.amount.toFixed(4);
  }

  multiply(qty: Quantity | number): Cost {
    const factor = qty instanceof Quantity ? qty.decimal : new Decimal(qty);
    return new Cost(this.amount.times(factor).toDecimalPlaces(4, Decimal.ROUND_HALF_UP));
  }

  equals(other: Cost): boolean {
    return this.amount.equals(other.decimal);
  }
}
