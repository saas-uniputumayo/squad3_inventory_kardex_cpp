import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  INVENTORY_REPOSITORY_PORT,
  InventoryRepositoryPort,
} from '../../domain/ports/outbound/inventory-repository.port';
import { DispatchStockDto } from '../dtos/dispatch-stock.dto';
import { Quantity } from '../../domain/value-objects/quantity.vo';
import { StockMove } from '../../domain/entities/stock-move.entity';
import {
  InsufficientStockException,
  ProductNotFoundException,
  WarehouseNotFoundException,
} from '../../domain/exceptions/inventory.exceptions';

export interface DispatchStockResult {
  moveId: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  previousStock: number;
  newStock: number;
  referenceDocument?: string | null;
}

@Injectable()
export class DispatchStockUseCase {
  constructor(
    @Inject(INVENTORY_REPOSITORY_PORT)
    private readonly repository: InventoryRepositoryPort,
  ) {}

  async execute(
    tenantId: string,
    dto: DispatchStockDto,
    userId: string,
  ): Promise<DispatchStockResult> {
    const product = await this.repository.findProductById(tenantId, dto.productId);
    if (!product) {
      throw new ProductNotFoundException(`Producto con ID ${dto.productId} no encontrado`);
    }

    const warehouse = await this.repository.findWarehouseById(tenantId, dto.warehouseId);
    if (!warehouse) {
      throw new WarehouseNotFoundException(`Bodega con ID ${dto.warehouseId} no encontrada`);
    }

    const quant = await this.repository.getStockQuantWithLock(
      tenantId,
      dto.productId,
      dto.warehouseId,
    );

    if (!quant) {
      throw new InsufficientStockException(
        `No hay existencia registrada para el producto ${product.sku} en la bodega ${warehouse.name}`,
      );
    }

    const requestedQty = new Quantity(dto.quantity);
    const available = quant.getAvailableQuantity();

    if (requestedQty.isGreaterThan(available)) {
      throw new InsufficientStockException(
        `Stock insuficiente en bodega ${warehouse.name}. Disponible: ${available.toString()}, Solicitado: ${requestedQty.toString()}`,
      );
    }

    const previousStock = quant.quantityOnHand;
    const updatedQuant = quant.dispatch(requestedQty);
    const newStock = updatedQuant.quantityOnHand;

    const unitCost = product.costPrice;
    const totalCost = unitCost.multiply(requestedQty.toNumber());

    const moveId = randomUUID();
    const move = new StockMove(
      moveId,
      tenantId,
      dto.productId,
      dto.warehouseId,
      'SALE_DISPATCH',
      requestedQty,
      unitCost,
      totalCost,
      previousStock,
      newStock,
      userId,
      dto.referenceDocument || null,
      dto.referenceDocumentId || null,
      new Date(),
    );

    await this.repository.saveStockQuant(updatedQuant);
    await this.repository.saveStockMove(move);

    return {
      moveId,
      productId: dto.productId,
      warehouseId: dto.warehouseId,
      quantity: requestedQty.toNumber(),
      unitCost: unitCost.toNumber(),
      totalCost: totalCost.toNumber(),
      previousStock: previousStock.toNumber(),
      newStock: newStock.toNumber(),
      referenceDocument: dto.referenceDocument || null,
    };
  }
}
