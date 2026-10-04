import { Inject, Injectable } from '@nestjs/common';
import {
  INVENTORY_REPOSITORY_PORT,
  InventoryRepositoryPort,
} from '../../domain/ports/outbound/inventory-repository.port';
import { Warehouse } from '../../domain/entities/warehouse.entity';

@Injectable()
export class ListWarehousesUseCase {
  constructor(
    @Inject(INVENTORY_REPOSITORY_PORT)
    private readonly repository: InventoryRepositoryPort,
  ) {}

  async execute(tenantId: string, branchId?: string): Promise<Warehouse[]> {
    return this.repository.findWarehouses(tenantId, branchId);
  }
}
