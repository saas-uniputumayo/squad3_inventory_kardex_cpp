import { Cost } from '../value-objects/cost.vo';
import { Quantity } from '../value-objects/quantity.vo';

export class Product {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly sku: string,
    public readonly name: string,
    public readonly category: string = 'GENERAL',
    public readonly unitOfMeasure: string = 'UNIDAD',
    public readonly costPrice: Cost = new Cost(0),
    public readonly salePrice: number = 0,
    public readonly taxRate: number = 0.19,
    public readonly minStockAlert: Quantity = new Quantity(5),
    public readonly barcode?: string | null,
    public readonly description?: string | null,
    public readonly wholesalePrice?: number | null,
    public readonly isActive: boolean = true,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date(),
  ) {}

  updatePricesAndAlert(
    costPrice?: Cost,
    salePrice?: number,
    wholesalePrice?: number | null,
    minStockAlert?: Quantity,
    description?: string | null,
  ): Product {
    return new Product(
      this.id,
      this.tenantId,
      this.sku,
      this.name,
      this.category,
      this.unitOfMeasure,
      costPrice !== undefined ? costPrice : this.costPrice,
      salePrice !== undefined ? salePrice : this.salePrice,
      this.taxRate,
      minStockAlert !== undefined ? minStockAlert : this.minStockAlert,
      this.barcode,
      description !== undefined ? description : this.description,
      wholesalePrice !== undefined ? wholesalePrice : this.wholesalePrice,
      this.isActive,
      this.createdAt,
      new Date(),
    );
  }

  deactivate(): Product {
    return new Product(
      this.id,
      this.tenantId,
      this.sku,
      this.name,
      this.category,
      this.unitOfMeasure,
      this.costPrice,
      this.salePrice,
      this.taxRate,
      this.minStockAlert,
      this.barcode,
      this.description,
      this.wholesalePrice,
      false,
      this.createdAt,
      new Date(),
    );
  }
}
