import { Quantity } from '../value-objects/quantity.vo';
import { InsufficientStockException } from '../exceptions/inventory.exceptions';

export class StockQuant {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly productId: string,
    public readonly warehouseId: string,
    public readonly quantityOnHand: Quantity,
    public readonly reservedQuantity: Quantity = new Quantity(0),
    public readonly updatedAt: Date = new Date(),
  ) {}

  getAvailableQuantity(): Quantity {
    return this.quantityOnHand.subtract(this.reservedQuantity);
  }

  dispatch(qty: Quantity): StockQuant {
    const available = this.getAvailableQuantity();
    if (qty.isGreaterThan(available)) {
      throw new InsufficientStockException(
        `Stock insuficiente en bodega. Disponible: ${available.toString()}, Solicitado: ${qty.toString()}`
      );
    }
    const newOnHand = this.quantityOnHand.subtract(qty);
    return new StockQuant(
      this.id,
      this.tenantId,
      this.productId,
      this.warehouseId,
      newOnHand,
      this.reservedQuantity,
      new Date(),
    );
  }

  receive(qty: Quantity): StockQuant {
    const newOnHand = this.quantityOnHand.add(qty);
    return new StockQuant(
      this.id,
      this.tenantId,
      this.productId,
      this.warehouseId,
      newOnHand,
      this.reservedQuantity,
      new Date(),
    );
  }
}
