import { InventoryRepositoryPort } from '../../domain/ports/outbound/inventory-repository.port';
import { Warehouse } from '../../domain/entities/warehouse.entity';
import { CreateWarehouseDto } from '../dtos/create-warehouse.dto';
import * as crypto from 'crypto';

export class CreateWarehouseUseCase {
  constructor(private readonly inventoryRepo: InventoryRepositoryPort) {}

  async execute(tenantId: string, dto: CreateWarehouseDto): Promise<Warehouse> {
    const warehouse = new Warehouse(
      crypto.randomUUID(),
      tenantId,
      dto.branchId,
      dto.code.trim().toUpperCase(),
      dto.name.trim(),
      dto.address || null,
      true,
      new Date(),
      new Date(),
    );

    return await this.inventoryRepo.saveWarehouse(warehouse);
  }
}
