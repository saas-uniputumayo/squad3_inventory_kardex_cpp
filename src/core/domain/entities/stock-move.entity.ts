import { Cost } from '../value-objects/cost.vo';
import { Quantity } from '../value-objects/quantity.vo';

export type StockMoveType =
  | 'PURCHASE_RECEIPT'
  | 'SALE_DISPATCH'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'SHRINKAGE_LOSS'
  | 'VOID_RETURN';

export class StockMove {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly productId: string,
    public readonly warehouseId: string,
    public readonly moveType: StockMoveType,
    public readonly quantity: Quantity,
    public readonly unitCost: Cost,
    public readonly totalCost: Cost,
    public readonly previousStock: Quantity,
    public readonly newStock: Quantity,
    public readonly createdBy: string,
    public readonly referenceDocument?: string | null,
    public readonly referenceDocumentId?: string | null,
    public readonly createdAt: Date = new Date(),
  ) {}

  isOutflow(): boolean {
    return (
      this.moveType === 'SALE_DISPATCH' ||
      this.moveType === 'TRANSFER_OUT' ||
      this.moveType === 'SHRINKAGE_LOSS'
    );
  }

  isInflow(): boolean {
    return (
      this.moveType === 'PURCHASE_RECEIPT' ||
      this.moveType === 'TRANSFER_IN' ||
      this.moveType === 'VOID_RETURN'
    );
  }
}
