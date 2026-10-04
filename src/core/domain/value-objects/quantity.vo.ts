import Decimal from 'decimal.js';

export class Quantity {
  private readonly amount: Decimal;

  constructor(amount: number | string | Decimal) {
    const dec = new Decimal(amount || 0);
    if (dec.isNegative()) {
      throw new Error('La cantidad de inventario no puede ser negativa.');
    }
    this.amount = dec.toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
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
    return this.amount.toFixed(3);
  }

  add(other: Quantity): Quantity {
    return new Quantity(this.amount.plus(other.decimal));
  }

  subtract(other: Quantity): Quantity {
    const diff = this.amount.minus(other.decimal);
    if (diff.isNegative()) {
      throw new Error('La cantidad resultante no puede ser negativa (Stock insuficiente).');
    }
    return new Quantity(diff);
  }

  isGreaterThan(other: Quantity): boolean {
    return this.amount.greaterThan(other.decimal);
  }

  isGreaterThanOrEqualTo(other: Quantity): boolean {
    return this.amount.greaterThanOrEqualTo(other.decimal);
  }

  isZero(): boolean {
    return this.amount.isZero();
  }

  equals(other: Quantity): boolean {
    return this.amount.equals(other.decimal);
  }
}
