import {
  InventoryRepositoryPort,
  ProductStockOverview,
} from '../../domain/ports/outbound/inventory-repository.port';

export class ListProductsUseCase {
  constructor(private readonly inventoryRepo: InventoryRepositoryPort) {}

  async execute(
    tenantId: string,
    filters?: { search?: string; category?: string; page?: number; limit?: number },
  ): Promise<{ data: ProductStockOverview[]; total: number }> {
    return await this.inventoryRepo.findProducts(tenantId, filters);
  }
}
