import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  INVENTORY_REPOSITORY_PORT,
  InventoryRepositoryPort,
} from '../../domain/ports/outbound/inventory-repository.port';
import { TransferStockDto } from '../dtos/transfer-stock.dto';
import { Quantity } from '../../domain/value-objects/quantity.vo';
import { StockMove } from '../../domain/entities/stock-move.entity';
import { StockQuant } from '../../domain/entities/stock-quant.entity';
import {
  InsufficientStockException,
  InventoryValidationException,
  ProductNotFoundException,
  WarehouseNotFoundException,
} from '../../domain/exceptions/inventory.exceptions';

export interface TransferStockResult {
  transferOutMoveId: string;
  transferInMoveId: string;
  productId: string;
  sourceWarehouseId: string;
  targetWarehouseId: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  referenceDocument?: string | null;
}

@Injectable()
export class TransferStockUseCase {
  constructor(
    @Inject(INVENTORY_REPOSITORY_PORT)
    private readonly repository: InventoryRepositoryPort,
  ) {}

  async execute(
    tenantId: string,
    dto: TransferStockDto,
    userId: string,
  ): Promise<TransferStockResult> {
    if (dto.sourceWarehouseId === dto.targetWarehouseId) {
      throw new InventoryValidationException(
        'La bodega origen y la bodega destino no pueden ser iguales para un traslado',
      );
    }

    const product = await this.repository.findProductById(tenantId, dto.productId);
    if (!product) {
      throw new ProductNotFoundException(`Producto con ID ${dto.productId} no encontrado`);
    }

    const sourceWarehouse = await this.repository.findWarehouseById(tenantId, dto.sourceWarehouseId);
    if (!sourceWarehouse) {
      throw new WarehouseNotFoundException(`Bodega origen ${dto.sourceWarehouseId} no encontrada`);
    }

    const targetWarehouse = await this.repository.findWarehouseById(tenantId, dto.targetWarehouseId);
    if (!targetWarehouse) {
      throw new WarehouseNotFoundException(`Bodega destino ${dto.targetWarehouseId} no encontrada`);
    }

    // Lock both quants in consistent order to prevent deadlocks
    const [firstWhId, secondWhId] = [dto.sourceWarehouseId, dto.targetWarehouseId].sort();
    const quantA = await this.repository.getStockQuantWithLock(tenantId, dto.productId, firstWhId);
    const quantB = await this.repository.getStockQuantWithLock(tenantId, dto.productId, secondWhId);

    const sourceQuant = firstWhId === dto.sourceWarehouseId ? quantA : quantB;
    const targetQuant = firstWhId === dto.targetWarehouseId ? quantA : quantB;

    if (!sourceQuant) {
      throw new InsufficientStockException(
        `No hay existencia registrada en la bodega origen ${sourceWarehouse.name}`,
      );
    }

    const transferQty = new Quantity(dto.quantity);
    const available = sourceQuant.getAvailableQuantity();

    if (transferQty.isGreaterThan(available)) {
      throw new InsufficientStockException(
        `Stock insuficiente en bodega origen ${sourceWarehouse.name}. Disponible: ${available.toString()}, Solicitado: ${transferQty.toString()}`,
      );
    }

    const sourcePreviousStock = sourceQuant.quantityOnHand;
    const updatedSourceQuant = sourceQuant.dispatch(transferQty);

    const targetPreviousStock = targetQuant ? targetQuant.quantityOnHand : new Quantity(0);
    const updatedTargetQuant = targetQuant
      ? targetQuant.receive(transferQty)
      : new StockQuant(
          randomUUID(),
          tenantId,
          dto.productId,
          dto.targetWarehouseId,
          transferQty,
          new Quantity(0),
          new Date(),
        );

    const unitCost = product.costPrice;
    const totalCost = unitCost.multiply(transferQty.toNumber());

    const outMoveId = randomUUID();
    const inMoveId = randomUUID();

    const transferOutMove = new StockMove(
      outMoveId,
      tenantId,
      dto.productId,
      dto.sourceWarehouseId,
      'TRANSFER_OUT',
      transferQty,
      unitCost,
      totalCost,
      sourcePreviousStock,
      updatedSourceQuant.quantityOnHand,
      userId,
      dto.referenceDocument || `TRASLADO_HACIA_${targetWarehouse.code}`,
      inMoveId,
      new Date(),
    );

    const transferInMove = new StockMove(
      inMoveId,
      tenantId,
      dto.productId,
      dto.targetWarehouseId,
      'TRANSFER_IN',
      transferQty,
      unitCost,
      totalCost,
      targetPreviousStock,
      updatedTargetQuant.quantityOnHand,
      userId,
      dto.referenceDocument || `TRASLADO_DESDE_${sourceWarehouse.code}`,
      outMoveId,
      new Date(),
    );

    await this.repository.saveStockQuant(updatedSourceQuant);
    await this.repository.saveStockQuant(updatedTargetQuant);
    await this.repository.saveStockMove(transferOutMove);
    await this.repository.saveStockMove(transferInMove);

    return {
      transferOutMoveId: outMoveId,
      transferInMoveId: inMoveId,
      productId: dto.productId,
      sourceWarehouseId: dto.sourceWarehouseId,
      targetWarehouseId: dto.targetWarehouseId,
      quantity: transferQty.toNumber(),
      unitCost: unitCost.toNumber(),
      totalCost: totalCost.toNumber(),
      referenceDocument: dto.referenceDocument || null,
    };
  }
}
