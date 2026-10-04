import { Inject, Injectable } from '@nestjs/common';
import {
  INVENTORY_REPOSITORY_PORT,
  InventoryRepositoryPort,
  KardexReport,
} from '../../domain/ports/outbound/inventory-repository.port';
import { ProductNotFoundException } from '../../domain/exceptions/inventory.exceptions';

@Injectable()
export class GetKardexUseCase {
  constructor(
    @Inject(INVENTORY_REPOSITORY_PORT)
    private readonly repository: InventoryRepositoryPort,
  ) {}

  async execute(
    tenantId: string,
    productId: string,
    warehouseId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<KardexReport> {
    const product = await this.repository.findProductById(tenantId, productId);
    if (!product) {
      throw new ProductNotFoundException(`Producto con ID ${productId} no encontrado`);
    }

    return this.repository.getProductKardex(
      tenantId,
      productId,
      warehouseId,
      startDate,
      endDate,
    );
  }
}
