import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  INVENTORY_REPOSITORY_PORT,
  InventoryRepositoryPort,
} from '../../domain/ports/outbound/inventory-repository.port';
import { ReverseMoveDto } from '../dtos/reverse-move.dto';
import { Quantity } from '../../domain/value-objects/quantity.vo';
import { StockMove } from '../../domain/entities/stock-move.entity';
import { StockQuant } from '../../domain/entities/stock-quant.entity';
import {
  InsufficientStockException,
  InventoryValidationException,
} from '../../domain/exceptions/inventory.exceptions';

export interface ReverseMoveResult {
  reversalMoveId: string;
  originalMoveId: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  previousStock: number;
  newStock: number;
  reason: string;
}

@Injectable()
export class ReverseStockMoveUseCase {
  constructor(
    @Inject(INVENTORY_REPOSITORY_PORT)
    private readonly repository: InventoryRepositoryPort,
  ) {}

  async execute(
    tenantId: string,
    dto: ReverseMoveDto,
    userId: string,
  ): Promise<ReverseMoveResult> {
    const originalMove = await this.repository.findStockMoveById(tenantId, dto.originalMoveId);
    if (!originalMove) {
      throw new InventoryValidationException(
        `Movimiento de inventario ${dto.originalMoveId} no encontrado para este tenant`,
      );
    }

    if (originalMove.moveType === 'VOID_RETURN') {
      throw new InventoryValidationException(
        `El movimiento ${dto.originalMoveId} ya es una reversión y no puede ser reversado nuevamente`,
      );
    }

    const quant = await this.repository.getStockQuantWithLock(
      tenantId,
      originalMove.productId,
      originalMove.warehouseId,
    );

    let updatedQuant: StockQuant;
    let previousStock: Quantity;

    if (originalMove.isOutflow()) {
      // Originally stock was decreased, so reversal puts stock back (increases)
      previousStock = quant ? quant.quantityOnHand : new Quantity(0);
      updatedQuant = quant
        ? quant.receive(originalMove.quantity)
        : new StockQuant(
            randomUUID(),
            tenantId,
            originalMove.productId,
            originalMove.warehouseId,
            originalMove.quantity,
            new Quantity(0),
            new Date(),
          );
    } else {
      // Originally stock was increased, so reversal takes stock out (decreases)
      if (!quant) {
        throw new InsufficientStockException(
          `No hay stock disponible en bodega para reversar el ingreso de ${originalMove.quantity.toString()}`,
        );
      }
      previousStock = quant.quantityOnHand;
      const available = quant.getAvailableQuantity();
      if (originalMove.quantity.isGreaterThan(available)) {
        throw new InsufficientStockException(
          `Stock insuficiente para reversar ingreso. Disponible: ${available.toString()}, Requerido: ${originalMove.quantity.toString()}`,
        );
      }
      updatedQuant = quant.dispatch(originalMove.quantity);
    }

    const reversalMoveId = randomUUID();
    const reversalMove = new StockMove(
      reversalMoveId,
      tenantId,
      originalMove.productId,
      originalMove.warehouseId,
      'VOID_RETURN',
      originalMove.quantity,
      originalMove.unitCost,
      originalMove.totalCost,
      previousStock,
      updatedQuant.quantityOnHand,
      userId,
      `REVERSAL_OF_${originalMove.id}: ${dto.reason}`,
      originalMove.id,
      new Date(),
    );

    await this.repository.saveStockQuant(updatedQuant);
    await this.repository.saveStockMove(reversalMove);

    return {
      reversalMoveId,
      originalMoveId: originalMove.id,
      productId: originalMove.productId,
      warehouseId: originalMove.warehouseId,
      quantity: originalMove.quantity.toNumber(),
      unitCost: originalMove.unitCost.toNumber(),
      totalCost: originalMove.totalCost.toNumber(),
      previousStock: previousStock.toNumber(),
      newStock: updatedQuant.quantityOnHand.toNumber(),
      reason: dto.reason,
    };
  }
}
