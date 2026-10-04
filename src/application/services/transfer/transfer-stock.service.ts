import { randomUUID } from 'node:crypto';
import { InventoryBalance } from '../../../domain/entities/inventory-balance/entity';
import { InventoryMovement } from '../../../domain/entities/inventory-movement/entity';
import { InventoryMovementLine } from '../../../domain/entities/inventory-movement/line.entity';
import { InventoryLedgerEntry } from '../../../domain/entities/inventory-ledger-entry/entity';
import { InventoryTransfer } from '../../../domain/entities/inventory-transfer/entity';
import { InventoryTransferLine } from '../../../domain/entities/inventory-transfer/line.entity';
import { InvalidInventoryBalanceException } from '../../../domain/exceptions/invalid-inventory-balance.exception';
import { InvalidInventoryTransferException } from '../../../domain/exceptions/invalid-inventory-transfer.exception';
import { InvalidWarehouseException } from '../../../domain/exceptions/invalid-warehouse.exception';
import {
    MovementSource,
    MovementStatus,
    MovementType,
    ReferenceType,
} from '../../../domain/types';
import { MovementReferenceVO } from '../../../domain/value-objects/movement-reference.vo';
import { QuantityVO } from '../../../domain/value-objects/quantity.vo';
import { TransferReferenceVO } from '../../../domain/value-objects/transfer-reference.vo';
import {
    IdempotencyConflictException,
    ProductVariantNotFoundException,
    WarehouseNotFoundException,
} from '../../exceptions';
import {
    TransferStockCommand,
    TransferStockLineResult,
    TransferStockResult,
    TransferStockUseCase,
} from '../../ports/in/transfer-stock.use-case';
import {
    IdempotencyPort,
    IdempotencyStatus,
} from '../../ports/out/idempotency.port';
import { ProductVariantRepositoryPort } from '../../ports/out/product-variant-repository.port';
import { UnitOfWorkPort } from '../../ports/out/unit-of-work.port';
import { WarehouseRepositoryPort } from '../../ports/out/warehouse-repository.port';

export class TransferStockService implements TransferStockUseCase {
    constructor(
        private readonly warehouseRepository: WarehouseRepositoryPort,
        private readonly productVariantRepository: ProductVariantRepositoryPort,
        private readonly idempotencyPort: IdempotencyPort,
        private readonly unitOfWork: UnitOfWorkPort,
    ) { }

    async execute(command: TransferStockCommand): Promise<TransferStockResult> {
        if (command.idempotencyKey) {
            const cached = await this.idempotencyPort.get<TransferStockResult>(
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
                        'TRANSFER_STOCK',
                    );
                }
            }
        }

        if (command.sourceWarehouseId === command.destinationWarehouseId) {
            throw new InvalidInventoryTransferException(
                'La bodega de origen y destino deben ser diferentes',
            );
        }

        const sourceWh = await this.warehouseRepository.findById(
            command.tenantId,
            command.sourceWarehouseId,
        );

        if (!sourceWh) {
            throw new WarehouseNotFoundException(command.sourceWarehouseId);
        }

        if (!sourceWh.canPerformInventoryOperations()) {
            throw new InvalidWarehouseException(
                `La bodega de origen '${command.sourceWarehouseId}' no se encuentra activa u operativa`,
            );
        }

        const destWh = await this.warehouseRepository.findById(
            command.tenantId,
            command.destinationWarehouseId,
        );

        if (!destWh) {
            throw new WarehouseNotFoundException(command.destinationWarehouseId);
        }

        if (!destWh.canPerformInventoryOperations()) {
            throw new InvalidWarehouseException(
                `La bodega de destino '${command.destinationWarehouseId}' no se encuentra activa u operativa`,
            );
        }

        const resolvedLines: Array<{
            productId: string;
            variantId: string;
            quantity: typeof command.lines[0]['quantity'];
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

        resolvedLines.sort((a, b) =>
            a.productId.localeCompare(b.productId) || a.variantId.localeCompare(b.variantId),
        );

        const transferId = randomUUID();
        const transferRefVO = TransferReferenceVO.create(command.referenceDocument);

        const transfer = InventoryTransfer.create({
            id: transferId,
            tenantId: command.tenantId,
            sourceWarehouseId: command.sourceWarehouseId,
            destinationWarehouseId: command.destinationWarehouseId,
            reference: transferRefVO,
            notes: command.notes,
            occurredAt: command.occurredAt,
        });

        const outboundMovementId = randomUUID();
        const inboundMovementId = randomUUID();

        const outboundLines: InventoryMovementLine[] = [];
        const inboundLines: InventoryMovementLine[] = [];
        const outboundLedgerEntries: InventoryLedgerEntry[] = [];
        const inboundLedgerEntries: InventoryLedgerEntry[] = [];
        const lineResults: TransferStockLineResult[] = [];

        const isTwoPhase = command.isTwoPhase === true;

        const result = await this.unitOfWork.execute(async (tx) => {
            let lineNumber = 1;

            for (const line of resolvedLines) {
                const sourceBalance = await tx.inventoryBalanceRepository.findForUpdate(
                    command.tenantId,
                    command.sourceWarehouseId,
                    line.productId,
                    line.variantId,
                );

                if (!sourceBalance) {
                    throw new InvalidInventoryBalanceException(
                        'No hay existencias suficientes en la bodega de origen para realizar el traslado',
                    );
                }

                const quantityVO = QuantityVO.create(line.quantity, {
                    unitOfMeasureId: sourceBalance.getUnitOfMeasureId(),
                    allowsFraction: sourceBalance.getAllowsFraction(),
                    decimalPlaces: sourceBalance.getDecimalPlaces(),
                });

                const unitCostVO = sourceBalance.getAverageCost();

                const dispatchValueVO = sourceBalance.dispatch(quantityVO);

                const transferLine = InventoryTransferLine.create({
                    id: randomUUID(),
                    transferId,
                    productId: line.productId,
                    variantId: line.variantId,
                    unitOfMeasureId: sourceBalance.getUnitOfMeasureId(),
                    allowsFraction: sourceBalance.getAllowsFraction(),
                    decimalPlaces: sourceBalance.getDecimalPlaces(),
                    quantity: quantityVO.getAmount(),
                    transferUnitCost: unitCostVO.getAmount(),
                    transferTotalCost: dispatchValueVO.getAmount(),
                    lineNumber,
                });

                transfer.addLine(transferLine);

                const outLineId = randomUUID();

                const outLine = InventoryMovementLine.create({
                    id: outLineId,
                    movementId: outboundMovementId,
                    productId: line.productId,
                    variantId: line.variantId,
                    unitOfMeasureId: sourceBalance.getUnitOfMeasureId(),
                    allowsFraction: sourceBalance.getAllowsFraction(),
                    decimalPlaces: sourceBalance.getDecimalPlaces(),
                    currency: sourceBalance.getCurrency(),
                    quantity: quantityVO.getAmount(),
                    unitCost: unitCostVO.getAmount(),
                    totalCost: dispatchValueVO.getAmount(),
                    lineNumber,
                });

                outboundLines.push(outLine);

                const outLedger = InventoryLedgerEntry.create({
                    id: randomUUID(),
                    tenantId: command.tenantId,
                    warehouseId: command.sourceWarehouseId,
                    movementId: outboundMovementId,
                    movementLineId: outLineId,
                    productId: line.productId,
                    variantId: line.variantId,
                    unitOfMeasureId: sourceBalance.getUnitOfMeasureId(),
                    allowsFraction: sourceBalance.getAllowsFraction(),
                    decimalPlaces: sourceBalance.getDecimalPlaces(),
                    currency: sourceBalance.getCurrency(),
                    movementType: MovementType.TRANSFER_OUT,
                    source: MovementSource.TRANSFER,
                    quantityOut: quantityVO,
                    unitCost: unitCostVO,
                    totalValue: dispatchValueVO,
                    balanceQuantity: sourceBalance.getQuantityOnHand(),
                    balanceValue: sourceBalance.getInventoryValue(),
                    balanceAverageCost: sourceBalance.getAverageCost(),
                    referenceType: ReferenceType.TRANSFER,
                    referenceId: transferId,
                    referenceDocument: command.referenceDocument,
                    occurredAt: command.occurredAt,
                });

                outboundLedgerEntries.push(outLedger);

                await tx.inventoryBalanceRepository.save(sourceBalance);

                if (!isTwoPhase) {
                    let destBalance = await tx.inventoryBalanceRepository.findForUpdate(
                        command.tenantId,
                        command.destinationWarehouseId,
                        line.productId,
                        line.variantId,
                    );

                    if (!destBalance) {
                        destBalance = InventoryBalance.create({
                            id: randomUUID(),
                            tenantId: command.tenantId,
                            warehouseId: command.destinationWarehouseId,
                            productId: line.productId,
                            variantId: line.variantId,
                            unitOfMeasureId: sourceBalance.getUnitOfMeasureId(),
                            allowsFraction: sourceBalance.getAllowsFraction(),
                            decimalPlaces: sourceBalance.getDecimalPlaces(),
                            currency: sourceBalance.getCurrency(),
                            quantityOnHand: 0,
                            reservedQuantity: 0,
                            averageCost: 0,
                            inventoryValue: 0,
                        });
                    }

                    const prevDestAvgCost = destBalance.getAverageCost();
                    const prevDestValue = destBalance.getInventoryValue();

                    destBalance.receive(quantityVO, unitCostVO);

                    const inLineId = randomUUID();

                    const inLine = InventoryMovementLine.create({
                        id: inLineId,
                        movementId: inboundMovementId,
                        productId: line.productId,
                        variantId: line.variantId,
                        unitOfMeasureId: destBalance.getUnitOfMeasureId(),
                        allowsFraction: destBalance.getAllowsFraction(),
                        decimalPlaces: destBalance.getDecimalPlaces(),
                        currency: destBalance.getCurrency(),
                        quantity: quantityVO.getAmount(),
                        unitCost: unitCostVO.getAmount(),
                        totalCost: dispatchValueVO.getAmount(),
                        lineNumber,
                    });

                    inboundLines.push(inLine);

                    const inLedger = InventoryLedgerEntry.create({
                        id: randomUUID(),
                        tenantId: command.tenantId,
                        warehouseId: command.destinationWarehouseId,
                        movementId: inboundMovementId,
                        movementLineId: inLineId,
                        productId: line.productId,
                        variantId: line.variantId,
                        unitOfMeasureId: destBalance.getUnitOfMeasureId(),
                        allowsFraction: destBalance.getAllowsFraction(),
                        decimalPlaces: destBalance.getDecimalPlaces(),
                        currency: destBalance.getCurrency(),
                        movementType: MovementType.TRANSFER_IN,
                        source: MovementSource.TRANSFER,
                        quantityIn: quantityVO,
                        unitCost: unitCostVO,
                        totalValue: dispatchValueVO,
                        balanceQuantity: destBalance.getQuantityOnHand(),
                        balanceValue: destBalance.getInventoryValue(),
                        balanceAverageCost: destBalance.getAverageCost(),
                        averageCostBefore: prevDestAvgCost,
                        averageCostAfter: destBalance.getAverageCost(),
                        inventoryValueBefore: prevDestValue,
                        inventoryValueAfter: destBalance.getInventoryValue(),
                        referenceType: ReferenceType.TRANSFER,
                        referenceId: transferId,
                        referenceDocument: command.referenceDocument,
                        occurredAt: command.occurredAt,
                    });

                    inboundLedgerEntries.push(inLedger);

                    await tx.inventoryBalanceRepository.save(destBalance);
                }

                lineResults.push({
                    productId: line.productId,
                    variantId: line.variantId,
                    quantity: quantityVO
                        .getAmount()
                        .toFixed(sourceBalance.getDecimalPlaces()),
                    unitCost: unitCostVO.getAmount().toFixed(6),
                    totalCost: dispatchValueVO.getAmount().toFixed(4),
                });

                lineNumber += 1;
            }

            const outRefVO = MovementReferenceVO.create(
                ReferenceType.TRANSFER,
                transferId,
            );

            const outboundMovement = InventoryMovement.create({
                id: outboundMovementId,
                tenantId: command.tenantId,
                warehouseId: command.sourceWarehouseId,
                type: MovementType.TRANSFER_OUT,
                status: MovementStatus.POSTED,
                source: MovementSource.TRANSFER,
                reference: outRefVO,
                notes: `Traslado hacia bodega ${command.destinationWarehouseId}`,
                occurredAt: command.occurredAt,
                lines: outboundLines,
            });

            await tx.inventoryMovementRepository.save(outboundMovement);
            await tx.inventoryLedgerRepository.saveMany(outboundLedgerEntries);

            if (!isTwoPhase) {
                const inRefVO = MovementReferenceVO.create(
                    ReferenceType.TRANSFER,
                    transferId,
                );

                const inboundMovement = InventoryMovement.create({
                    id: inboundMovementId,
                    tenantId: command.tenantId,
                    warehouseId: command.destinationWarehouseId,
                    type: MovementType.TRANSFER_IN,
                    status: MovementStatus.POSTED,
                    source: MovementSource.TRANSFER,
                    reference: inRefVO,
                    notes: `Recepción de traslado desde bodega ${command.sourceWarehouseId}`,
                    occurredAt: command.occurredAt,
                    lines: inboundLines,
                });

                await tx.inventoryMovementRepository.save(inboundMovement);
                await tx.inventoryLedgerRepository.saveMany(inboundLedgerEntries);

                transfer.completeAtomic(
                    outboundMovementId,
                    inboundMovementId,
                    command.performedById,
                );
            } else {
                transfer.dispatch(outboundMovementId);
            }

            await tx.inventoryTransferRepository.save(transfer);

            const transferResult: TransferStockResult = {
                transferId,
                status: transfer.getStatus(),
                referenceDocument: command.referenceDocument,
                sourceWarehouseId: command.sourceWarehouseId,
                destinationWarehouseId: command.destinationWarehouseId,
                lines: lineResults,
                outboundMovementId,
                inboundMovementId: isTwoPhase ? undefined : inboundMovementId,
                createdAt: transfer.getCreatedAt(),
            };

            return transferResult;
        });

        if (command.idempotencyKey) {
            await this.idempotencyPort.save({
                tenantId: command.tenantId,
                key: command.idempotencyKey,
                operation: 'TRANSFER_STOCK',
                response: result,
                resourceId: transferId,
            });
        }

        return result;
    }
}
