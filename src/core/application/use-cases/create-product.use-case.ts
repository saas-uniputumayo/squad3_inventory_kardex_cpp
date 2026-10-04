import { InventoryRepositoryPort } from '../../domain/ports/outbound/inventory-repository.port';
import { Product } from '../../domain/entities/product.entity';
import { Cost } from '../../domain/value-objects/cost.vo';
import { Quantity } from '../../domain/value-objects/quantity.vo';
import { CreateProductDto } from '../dtos/create-product.dto';
import { DuplicateSkuException } from '../../domain/exceptions/inventory.exceptions';
import * as crypto from 'crypto';

export class CreateProductUseCase {
  constructor(private readonly inventoryRepo: InventoryRepositoryPort) {}

  async execute(tenantId: string, dto: CreateProductDto): Promise<Product> {
    const existing = await this.inventoryRepo.findProductBySku(tenantId, dto.sku);
    if (existing) {
      throw new DuplicateSkuException(
        `Ya existe un producto con el SKU ${dto.sku} en este tenant.`
      );
    }

    const product = new Product(
      crypto.randomUUID(),
      tenantId,
      dto.sku.trim().toUpperCase(),
      dto.name.trim(),
      dto.category || 'GENERAL',
      dto.unitOfMeasure || 'UNIDAD',
      new Cost(dto.costPrice || 0),
      dto.salePrice,
      dto.taxRate !== undefined ? dto.taxRate : 0.19,
      new Quantity(dto.minStockAlert !== undefined ? dto.minStockAlert : 5),
      dto.barcode || null,
      dto.description || null,
      dto.wholesalePrice || null,
      true,
      new Date(),
      new Date(),
    );

    return await this.inventoryRepo.saveProduct(product);
  }
}
