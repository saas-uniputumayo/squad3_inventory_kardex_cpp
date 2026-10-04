import { Inject, Injectable } from '@nestjs/common';
import {
  INVENTORY_REPOSITORY_PORT,
  InventoryRepositoryPort,
} from '../../domain/ports/outbound/inventory-repository.port';

@Injectable()
export class GetStockAlertsUseCase {
  constructor(
    @Inject(INVENTORY_REPOSITORY_PORT)
    private readonly repository: InventoryRepositoryPort,
  ) {}

  async execute(tenantId: string): Promise<any[]> {
    return this.repository.getStockAlerts(tenantId);
  }
}
