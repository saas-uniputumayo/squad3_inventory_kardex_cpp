import { InventoryRepositoryPort } from '../../domain/ports/outbound/inventory-repository.port';
import { Product } from '../../domain/entities/product.entity';
import { Quantity } from '../../domain/value-objects/quantity.vo';
import { UpdateProductDto } from '../dtos/update-product.dto';
import { ProductNotFoundException } from '../../domain/exceptions/inventory.exceptions';

export class UpdateProductUseCase {
  constructor(private readonly inventoryRepo: InventoryRepositoryPort) {}

  async execute(tenantId: string, id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.inventoryRepo.findProductById(tenantId, id);
    if (!product) {
      throw new ProductNotFoundException(`Producto con ID ${id} no encontrado en el tenant.`);
    }

    const updated = product.updatePricesAndAlert(
      undefined,
      dto.salePrice,
      dto.wholesalePrice,
      dto.minStockAlert !== undefined ? new Quantity(dto.minStockAlert) : undefined,
      dto.description,
    );

    return await this.inventoryRepo.saveProduct(updated);
  }
}
