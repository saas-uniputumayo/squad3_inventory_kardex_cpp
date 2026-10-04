import { randomUUID } from 'node:crypto';
import Decimal from 'decimal.js';
import { InventoryBalance } from '../../../domain/entities/inventory-balance/entity';
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
import { UnitCostVO } from '../../../domain/value-objects/unit-cost.vo';
import { InvalidWarehouseException } from '../../../domain/exceptions/invalid-warehouse.exception';
import {
    IdempotencyConflictException,
    ProductNotFoundException,
    ProductVariantNotFoundException,
    UnitOfMeasureNotFoundException,
    WarehouseNotFoundException,
} from '../../exceptions';
import {
    ReceiveStockCommand,
    ReceiveStockLineResult,
    ReceiveStockResult,
    ReceiveStockUseCase,
} from '../../ports/in/receive-stock.use-case';
import {
    IdempotencyPort,
    IdempotencyStatus,
} from '../../ports/out/idempotency.port';
import { ProductRepositoryPort } from '../../ports/out/product-repository.port';
import { ProductVariantRepositoryPort } from '../../ports/out/product-variant-repository.port';
import { UnitOfMeasureRepositoryPort } from '../../ports/out/unit-of-measure-repository.port';
import { UnitOfWorkPort } from '../../ports/out/unit-of-work.port';
import { WarehouseRepositoryPort } from '../../ports/out/warehouse-repository.port';

export class ReceiveStockService implements ReceiveStockUseCase {
    constructor(
        private readonly warehouseRepository: WarehouseRepositoryPort,
        private readonly productRepository: ProductRepositoryPort,
        private readonly productVariantRepository: ProductVariantRepositoryPort,
        private readonly unitOfMeasureRepository: UnitOfMeasureRepositoryPort,
        private readonly idempotencyPort: IdempotencyPort,
        private readonly unitOfWork: UnitOfWorkPort,
    ) { }

    async execute(command: ReceiveStockCommand): Promise<ReceiveStockResult> {
        if (command.idempotencyKey) {
            const cached = await this.idempotencyPort.get<ReceiveStockResult>(
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
                        'RECEIVE_STOCK',
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
            unitCost: Decimal.Value;
            unitOfMeasureId: string;
        }> = [];

        for (const line of command.lines) {
            const product = await this.productRepository.findById(
                command.tenantId,
                line.productId,
            );

            if (!product) {
                throw new ProductNotFoundException(line.productId);
            }

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
                unitCost: line.unitCost,
                unitOfMeasureId: product.getUnitOfMeasureId(),
            });
        }

        resolvedLines.sort((a, b) =>
            a.productId.localeCompare(b.productId) || a.variantId.localeCompare(b.variantId),
        );

        const movementId = randomUUID();
        const movementLines: InventoryMovementLine[] = [];
        const ledgerEntries: InventoryLedgerEntry[] = [];
        const lineResults: ReceiveStockLineResult[] = [];
        let totalCostAccumulator = new Decimal(0);

        const result = await this.unitOfWork.execute(async (tx) => {
            let lineNumber = 1;

            for (const line of resolvedLines) {
                let balance = await tx.inventoryBalanceRepository.findForUpdate(
                    command.tenantId,
                    command.warehouseId,
                    line.productId,
                    line.variantId,
                );

                if (!balance) {
                    const uom = await this.unitOfMeasureRepository.findById(
                        command.tenantId,
                        line.unitOfMeasureId,
                    );

                    if (!uom) {
                        throw new UnitOfMeasureNotFoundException(line.unitOfMeasureId);
                    }

                    balance = InventoryBalance.create({
                        id: randomUUID(),
                        tenantId: command.tenantId,
                        warehouseId: command.warehouseId,
                        productId: line.productId,
                        variantId: line.variantId,
                        unitOfMeasureId: uom.getId(),
                        allowsFraction: uom.getAllowsFraction(),
                        decimalPlaces: uom.getDecimalPlaces(),
                        currency: 'COP',
                        quantityOnHand: 0,
                        reservedQuantity: 0,
                        averageCost: 0,
                        inventoryValue: 0,
                    });
                }

                const previousStockStr = balance
                    .getQuantityOnHand()
                    .getAmount()
                    .toFixed(balance.getDecimalPlaces());

                const previousAverageCostVO = balance.getAverageCost();
                const previousInventoryValueVO = balance.getInventoryValue();

                const quantityVO = QuantityVO.create(line.quantity, {
                    unitOfMeasureId: balance.getUnitOfMeasureId(),
                    allowsFraction: balance.getAllowsFraction(),
                    decimalPlaces: balance.getDecimalPlaces(),
                });

                const unitCostVO = UnitCostVO.create(
                    line.unitCost,
                    balance.getCurrency(),
                );

                balance.receive(quantityVO, unitCostVO);

                const newStockStr = balance
                    .getQuantityOnHand()
                    .getAmount()
                    .toFixed(balance.getDecimalPlaces());

                const lineTotalCostAmount = unitCostVO.multiply(
                    quantityVO.getAmount(),
                );

                totalCostAccumulator = totalCostAccumulator.plus(lineTotalCostAmount);

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
                    totalCost: lineTotalCostAmount,
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
                    movementType: MovementType.PURCHASE_RECEIPT,
                    source: command.source ?? MovementSource.PURCHASE,
                    quantityIn: quantityVO,
                    unitCost: unitCostVO,
                    totalValue: movementLine.getTotalCost(),
                    balanceQuantity: balance.getQuantityOnHand(),
                    balanceValue: balance.getInventoryValue(),
                    balanceAverageCost: balance.getAverageCost(),
                    averageCostBefore: previousAverageCostVO,
                    averageCostAfter: balance.getAverageCost(),
                    inventoryValueBefore: previousInventoryValueVO,
                    inventoryValueAfter: balance.getInventoryValue(),
                    referenceType: command.referenceType ?? ReferenceType.PURCHASE,
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
                    totalCost: lineTotalCostAmount.toFixed(4),
                    previousStock: previousStockStr,
                    newStock: newStockStr,
                    previousAverageCost: previousAverageCostVO.getAmount().toFixed(6),
                    newAverageCost: balance.getAverageCost().getAmount().toFixed(6),
                });

                await tx.inventoryBalanceRepository.save(balance);
            }

            const refId = command.referenceId ?? command.referenceDocument;
            const referenceVO = MovementReferenceVO.create(
                command.referenceType ?? ReferenceType.PURCHASE,
                refId,
            );

            const movement = InventoryMovement.create({
                id: movementId,
                tenantId: command.tenantId,
                warehouseId: command.warehouseId,
                type: MovementType.PURCHASE_RECEIPT,
                status: MovementStatus.POSTED,
                source: command.source ?? MovementSource.PURCHASE,
                reference: referenceVO,
                notes: command.notes,
                occurredAt: command.occurredAt,
                lines: movementLines,
            });

            await tx.inventoryMovementRepository.save(movement);
            await tx.inventoryLedgerRepository.saveMany(ledgerEntries);

            const receiveResult: ReceiveStockResult = {
                movementId,
                type: MovementType.PURCHASE_RECEIPT,
                status: MovementStatus.POSTED,
                warehouseId: command.warehouseId,
                referenceDocument: command.referenceDocument,
                lines: lineResults,
                totalReceivedCost: totalCostAccumulator.toFixed(4),
                createdAt: movement.getCreatedAt(),
            };

            return receiveResult;
        });

        if (command.idempotencyKey) {
            await this.idempotencyPort.save({
                tenantId: command.tenantId,
                key: command.idempotencyKey,
                operation: 'RECEIVE_STOCK',
                response: result,
                resourceId: movementId,
            });
        }

        return result;
    }
}
