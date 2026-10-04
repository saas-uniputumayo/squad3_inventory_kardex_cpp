import { randomUUID } from 'node:crypto';
import Decimal from 'decimal.js';
import { InventoryMovement } from '../../../domain/entities/inventory-movement/entity';
import { InventoryMovementLine } from '../../../domain/entities/inventory-movement/line.entity';
import { InventoryLedgerEntry } from '../../../domain/entities/inventory-ledger-entry/entity';
import {
    MovementSource,
    MovementStatus,
    MovementType,
    ReferenceType,
} from '../../../domain/types';
import { MovementReferenceVO } from '../../../domain/value-objects/movement-reference.vo';
import { QuantityVO } from '../../../domain/value-objects/quantity.vo';
import { InvalidInventoryBalanceException } from '../../../domain/exceptions/invalid-inventory-balance.exception';
import { InvalidWarehouseException } from '../../../domain/exceptions/invalid-warehouse.exception';
import {
    IdempotencyConflictException,
    ProductVariantNotFoundException,
    WarehouseNotFoundException,
} from '../../exceptions';
import {
    DispatchStockCommand,
    DispatchStockLineResult,
    DispatchStockResult,
    DispatchStockUseCase,
} from '../../ports/in/dispatch-stock.use-case';
import {
    IdempotencyPort,
    IdempotencyStatus,
} from '../../ports/out/idempotency.port';
import { ProductVariantRepositoryPort } from '../../ports/out/product-variant-repository.port';
import { UnitOfWorkPort } from '../../ports/out/unit-of-work.port';
import { WarehouseRepositoryPort } from '../../ports/out/warehouse-repository.port';

export class DispatchStockService implements DispatchStockUseCase {
    constructor(
        private readonly warehouseRepository: WarehouseRepositoryPort,
        private readonly productVariantRepository: ProductVariantRepositoryPort,
        private readonly idempotencyPort: IdempotencyPort,
        private readonly unitOfWork: UnitOfWorkPort,
    ) { }

    async execute(command: DispatchStockCommand): Promise<DispatchStockResult> {
        if (command.idempotencyKey) {
            const cached = await this.idempotencyPort.get<DispatchStockResult>(
                command.tenantId,
                command.idempotencyKey,
            );

            if (cached) {
                if (cached.status === IdempotencyStatus.COMPLETED && cached.response) {
                    return cached.response;
                }
                if (cached.status === IdempotencyStatus.STARTED) {
                    throw new IdempotencyConflictException(
                        command.idempotencyKey,
                        'DISPATCH_STOCK',
                    );
                }
            }
        }

        const warehouse = await this.warehouseRepository.findById(
            command.tenantId,
            command.warehouseId,
        );

        if (!warehouse) {
            throw new WarehouseNotFoundException(command.warehouseId);
        }

        if (!warehouse.canPerformInventoryOperations()) {
            throw new InvalidWarehouseException(
                `La bodega '${command.warehouseId}' no se encuentra activa u operativa para realizar movimientos de inventario`,
            );
        }

        const resolvedLines: Array<{
            productId: string;
            variantId: string;
            quantity: Decimal.Value;
        }> = [];

        for (const line of command.lines) {
            let variantId = line.variantId;

            if (!variantId) {
                const defaultVariant =
                    await this.productVariantRepository.findDefaultByProductId(
                        command.tenantId,
                        line.productId,
                    );

                if (!defaultVariant) {
                    throw new ProductVariantNotFoundException(
                        `producto:${line.productId}:default`,
                    );
                }

                variantId = defaultVariant.getId();
            }

            resolvedLines.push({
                productId: line.productId,
                variantId,
                quantity: line.quantity,
            });
        }

        // Orden determinístico para evitar interbloqueos (deadlocks) en PostgreSQL
        resolvedLines.sort((a, b) =>
            a.productId.localeCompare(b.productId) || a.variantId.localeCompare(b.variantId),
        );

        const movementId = randomUUID();
        const movementLines: InventoryMovementLine[] = [];
        const ledgerEntries: InventoryLedgerEntry[] = [];
        const lineResults: DispatchStockLineResult[] = [];
        let totalCostAccumulator = new Decimal(0);

        const result = await this.unitOfWork.execute(async (tx) => {
            let lineNumber = 1;

            for (const line of resolvedLines) {
                const balance = await tx.inventoryBalanceRepository.findForUpdate(
                    command.tenantId,
                    command.warehouseId,
                    line.productId,
                    line.variantId,
                );

                if (!balance) {
                    throw new InvalidInventoryBalanceException(
                        'No hay existencias suficientes para realizar el despacho',
                    );
                }

                const quantityVO = QuantityVO.create(line.quantity, {
                    unitOfMeasureId: balance.getUnitOfMeasureId(),
                    allowsFraction: balance.getAllowsFraction(),
                    decimalPlaces: balance.getDecimalPlaces(),
                });

                const previousStockStr = balance
                    .getQuantityOnHand()
                    .getAmount()
                    .toFixed(balance.getDecimalPlaces());

                const unitCostVO = balance.getAverageCost();

                const dispatchValueVO = balance.dispatch(quantityVO);

                const remainingStockStr = balance
                    .getQuantityOnHand()
                    .getAmount()
                    .toFixed(balance.getDecimalPlaces());

                totalCostAccumulator = totalCostAccumulator.plus(
                    dispatchValueVO.getAmount(),
                );

                const lineId = randomUUID();

                const movementLine = InventoryMovementLine.create({
                    id: lineId,
                    movementId,
                    productId: line.productId,
                    variantId: line.variantId,
                    unitOfMeasureId: balance.getUnitOfMeasureId(),
                    allowsFraction: balance.getAllowsFraction(),
                    decimalPlaces: balance.getDecimalPlaces(),
                    currency: balance.getCurrency(),
                    quantity: quantityVO.getAmount(),
                    unitCost: unitCostVO.getAmount(),
                    totalCost: dispatchValueVO.getAmount(),
                    lineNumber,
                });

                lineNumber += 1;
                movementLines.push(movementLine);

                const ledgerEntry = InventoryLedgerEntry.create({
                    id: randomUUID(),
                    tenantId: command.tenantId,
                    warehouseId: command.warehouseId,
                    movementId,
                    movementLineId: lineId,
                    productId: line.productId,
                    variantId: line.variantId,
                    unitOfMeasureId: balance.getUnitOfMeasureId(),
                    allowsFraction: balance.getAllowsFraction(),
                    decimalPlaces: balance.getDecimalPlaces(),
                    currency: balance.getCurrency(),
                    movementType: MovementType.SALE_DISPATCH,
                    source: command.source ?? MovementSource.POS,
                    quantityOut: quantityVO,
                    unitCost: unitCostVO,
                    totalValue: dispatchValueVO,
                    balanceQuantity: balance.getQuantityOnHand(),
                    balanceValue: balance.getInventoryValue(),
                    balanceAverageCost: balance.getAverageCost(),
                    referenceType: command.referenceType ?? ReferenceType.POS_SALE,
                    referenceId: command.referenceId,
                    referenceDocument: command.referenceDocument,
                    occurredAt: command.occurredAt,
                });

                ledgerEntries.push(ledgerEntry);

                lineResults.push({
                    productId: line.productId,
                    variantId: line.variantId,
                    quantity: quantityVO
                        .getAmount()
                        .toFixed(balance.getDecimalPlaces()),
                    unitCost: unitCostVO.getAmount().toFixed(6),
                    totalCost: dispatchValueVO.getAmount().toFixed(4),
                    previousStock: previousStockStr,
                    remainingStock: remainingStockStr,
                });

                await tx.inventoryBalanceRepository.save(balance);
            }

            const refId = command.referenceId ?? command.referenceDocument;
            const referenceVO = MovementReferenceVO.create(
                command.referenceType ?? ReferenceType.POS_SALE,
                refId,
            );

            const movement = InventoryMovement.create({
                id: movementId,
                tenantId: command.tenantId,
                warehouseId: command.warehouseId,
                type: MovementType.SALE_DISPATCH,
                status: MovementStatus.POSTED,
                source: command.source ?? MovementSource.POS,
                reference: referenceVO,
                notes: command.notes,
                occurredAt: command.occurredAt,
                lines: movementLines,
            });

            await tx.inventoryMovementRepository.save(movement);
            await tx.inventoryLedgerRepository.saveMany(ledgerEntries);

            const dispatchResult: DispatchStockResult = {
                movementId,
                type: MovementType.SALE_DISPATCH,
                status: MovementStatus.POSTED,
                warehouseId: command.warehouseId,
                referenceDocument: command.referenceDocument,
                lines: lineResults,
                totalDispatchCost: totalCostAccumulator.toFixed(4),
                createdAt: movement.getCreatedAt(),
            };

            return dispatchResult;
        });

        if (command.idempotencyKey) {
            await this.idempotencyPort.save({
                tenantId: command.tenantId,
                key: command.idempotencyKey,
                operation: 'DISPATCH_STOCK',
                response: result,
                resourceId: movementId,
            });
        }

        return result;
    }
}
