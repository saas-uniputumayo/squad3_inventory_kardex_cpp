import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import {
  INVENTORY_REPOSITORY_PORT,
  InventoryRepositoryPort,
} from '../../domain/ports/outbound/inventory-repository.port';
import { ReceiveStockDto } from '../dtos/receive-stock.dto';
import { Quantity } from '../../domain/value-objects/quantity.vo';
import { Cost } from '../../domain/value-objects/cost.vo';
import { StockQuant } from '../../domain/entities/stock-quant.entity';
import { StockMove } from '../../domain/entities/stock-move.entity';
import {
  ProductNotFoundException,
  WarehouseNotFoundException,
} from '../../domain/exceptions/inventory.exceptions';

export interface ReceiveStockResult {
  moveId: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  previousStock: number;
  newStock: number;
  newWeightedAverageCost: number;
  referenceDocument?: string | null;
}

@Injectable()
export class ReceiveStockUseCase {
  constructor(
    @Inject(INVENTORY_REPOSITORY_PORT)
    private readonly repository: InventoryRepositoryPort,
  ) {}

  async execute(
    tenantId: string,
    dto: ReceiveStockDto,
    userId: string,
  ): Promise<ReceiveStockResult> {
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

    const incomingQty = new Quantity(dto.quantity);
    const incomingUnitCost = new Cost(dto.unitCost);
    const previousStockQty = quant ? quant.quantityOnHand : new Quantity(0);

    // Dynamic CPP (Costo Promedio Ponderado)
    let newCalculatedCost: Cost;
    const prevStockNum = previousStockQty.toNumber();

    if (prevStockNum <= 0) {
      newCalculatedCost = incomingUnitCost;
    } else {
      const prevTotalCost = new Decimal(prevStockNum).mul(product.costPrice.toNumber());
      const incomingTotalCost = new Decimal(incomingQty.toNumber()).mul(incomingUnitCost.toNumber());
      const totalCombinedStock = new Decimal(prevStockNum).add(incomingQty.toNumber());

      const cppValue = prevTotalCost.add(incomingTotalCost).div(totalCombinedStock).toNumber();
      newCalculatedCost = new Cost(cppValue);
    }

    const updatedQuant = quant
      ? quant.receive(incomingQty)
      : new StockQuant(
          randomUUID(),
          tenantId,
          dto.productId,
          dto.warehouseId,
          incomingQty,
          new Quantity(0),
          new Date(),
        );

    const moveTotalCost = incomingUnitCost.multiply(incomingQty.toNumber());
    const moveId = randomUUID();

    const move = new StockMove(
      moveId,
      tenantId,
      dto.productId,
      dto.warehouseId,
      'PURCHASE_RECEIPT',
      incomingQty,
      incomingUnitCost,
      moveTotalCost,
      previousStockQty,
      updatedQuant.quantityOnHand,
      userId,
      dto.referenceDocument || null,
      dto.referenceDocumentId || null,
      new Date(),
    );

    await this.repository.updateProductCostPrice(tenantId, dto.productId, newCalculatedCost);
    await this.repository.saveStockQuant(updatedQuant);
    await this.repository.saveStockMove(move);

    return {
      moveId,
      productId: dto.productId,
      warehouseId: dto.warehouseId,
      quantity: incomingQty.toNumber(),
      unitCost: incomingUnitCost.toNumber(),
      totalCost: moveTotalCost.toNumber(),
      previousStock: previousStockQty.toNumber(),
      newStock: updatedQuant.quantityOnHand.toNumber(),
      newWeightedAverageCost: newCalculatedCost.toNumber(),
      referenceDocument: dto.referenceDocument || null,
    };
  }
}
