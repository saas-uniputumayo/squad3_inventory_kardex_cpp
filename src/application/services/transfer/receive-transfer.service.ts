import { randomUUID } from 'node:crypto';
import { InventoryBalance } from '../../../domain/entities/inventory-balance/entity';
import { InventoryMovement } from '../../../domain/entities/inventory-movement/entity';
import { InventoryMovementLine } from '../../../domain/entities/inventory-movement/line.entity';
import { InventoryLedgerEntry } from '../../../domain/entities/inventory-ledger-entry/entity';
import { TransferStatus } from '../../../domain/entities/inventory-transfer/entity';
import { InvalidInventoryTransferException } from '../../../domain/exceptions/invalid-inventory-transfer.exception';
import {
    MovementSource,
    MovementStatus,
    MovementType,
    ReferenceType,
} from '../../../domain/types';
import { MovementReferenceVO } from '../../../domain/value-objects/movement-reference.vo';
import { UnitCostVO } from '../../../domain/value-objects/unit-cost.vo';
import { InvalidWarehouseException } from '../../../domain/exceptions/invalid-warehouse.exception';
import {
    IdempotencyConflictException,
    TransferNotFoundException,
    WarehouseNotFoundException,
} from '../../exceptions';
import {
    ReceiveTransferCommand,
    ReceiveTransferResult,
    ReceiveTransferUseCase,
} from '../../ports/in/receive-transfer.use-case';
import {
    IdempotencyPort,
    IdempotencyStatus,
} from '../../ports/out/idempotency.port';
import { UnitOfWorkPort } from '../../ports/out/unit-of-work.port';
import { WarehouseRepositoryPort } from '../../ports/out/warehouse-repository.port';

export class ReceiveTransferService implements ReceiveTransferUseCase {
    constructor(
        private readonly warehouseRepository: WarehouseRepositoryPort,
        private readonly idempotencyPort: IdempotencyPort,
        private readonly unitOfWork: UnitOfWorkPort,
    ) { }

    async execute(command: ReceiveTransferCommand): Promise<ReceiveTransferResult> {
        if (command.idempotencyKey) {
            const lock = await this.idempotencyPort.acquire<ReceiveTransferResult>({
                tenantId: command.tenantId,
                key: command.idempotencyKey,
                operation: 'RECEIVE_TRANSFER',
            });

            if (lock.completed && lock.response) {
                return lock.response;
            }
        }

        try {
            const result = await this.unitOfWork.execute(async (tx) => {
            const transfer = await tx.inventoryTransferRepository.findById(
                command.tenantId,
                command.transferId,
            );

            if (!transfer) {
                throw new TransferNotFoundException(command.transferId);
            }

            if (!transfer.isInTransit()) {
                throw new InvalidInventoryTransferException(
                    'Solo una transferencia en tránsito (IN_TRANSIT) puede recibirse mediante receive()',
                );
            }

            const destWh = await tx.warehouseRepository.findById(
                command.tenantId,
                transfer.getDestinationWarehouseId(),
            );

            if (!destWh) {
                throw new WarehouseNotFoundException(transfer.getDestinationWarehouseId());
            }

            if (!destWh.canPerformInventoryOperations()) {
                throw new InvalidWarehouseException(
                    `La bodega '${transfer.getDestinationWarehouseId()}' no se encuentra activa u operativa`,
                );
            }

            const transferLines = transfer.getLines();
            if (!transferLines.length) {
                throw new InvalidInventoryTransferException(
                    'Una transferencia debe tener al menos una línea para completarse',
                );
            }

            // Orden determinista para evitar deadlocks de concurrencia
            const sortedLines = [...transferLines].sort((a, b) => {
                const pComp = a.getProductId().localeCompare(b.getProductId());
                if (pComp !== 0) return pComp;
                return a.getVariantId().localeCompare(b.getVariantId());
            });

            const inboundMovementId = randomUUID();
            const inboundLines: InventoryMovementLine[] = [];
            const inboundLedgerEntries: InventoryLedgerEntry[] = [];
            let lineNumber = 1;

            for (const line of sortedLines) {
                let destBalance =
                    await tx.inventoryBalanceRepository.findForUpdate(
                        command.tenantId,
                        transfer.getDestinationWarehouseId(),
                        line.getProductId(),
                        line.getVariantId(),
                    );

                if (!destBalance) {
                    destBalance = InventoryBalance.create({
                        id: randomUUID(),
                        tenantId: command.tenantId,
                        warehouseId: transfer.getDestinationWarehouseId(),
                        productId: line.getProductId(),
                        variantId: line.getVariantId(),
                        unitOfMeasureId: line.getUnitOfMeasureId(),
                        allowsFraction: line.getAllowsFraction(),
                        decimalPlaces: line.getDecimalPlaces(),
                    });
                }

                const prevAvgCost = destBalance.getAverageCost();
                const prevValue = destBalance.getInventoryValue();
                const lineQuantity = line.getQuantity();
                const lineUnitCost =
                    line.getTransferUnitCost() ??
                    UnitCostVO.create(0, destBalance.getCurrency());

                destBalance.receive(lineQuantity, lineUnitCost);

                const inLineId = randomUUID();
                const inLine = InventoryMovementLine.create({
                    id: inLineId,
                    movementId: inboundMovementId,
                    productId: line.getProductId(),
                    variantId: line.getVariantId(),
                    unitOfMeasureId: destBalance.getUnitOfMeasureId(),
                    allowsFraction: destBalance.getAllowsFraction(),
                    decimalPlaces: destBalance.getDecimalPlaces(),
                    currency: destBalance.getCurrency(),
                    quantity: lineQuantity.getAmount(),
                    unitCost: lineUnitCost.getAmount(),
                    totalCost: line.getTransferTotalCost()?.getAmount() ?? 0,
                    lineNumber,
                });

                inboundLines.push(inLine);

                const inLedger = InventoryLedgerEntry.create({
                    id: randomUUID(),
                    tenantId: command.tenantId,
                    warehouseId: transfer.getDestinationWarehouseId(),
                    movementId: inboundMovementId,
                    movementLineId: inLineId,
                    productId: line.getProductId(),
                    variantId: line.getVariantId(),
                    unitOfMeasureId: destBalance.getUnitOfMeasureId(),
                    allowsFraction: destBalance.getAllowsFraction(),
                    decimalPlaces: destBalance.getDecimalPlaces(),
                    currency: destBalance.getCurrency(),
                    movementType: MovementType.TRANSFER_IN,
                    source: MovementSource.TRANSFER,
                    quantityIn: line.getQuantity(),
                    unitCost: line.getTransferUnitCost(),
                    totalValue: line.getTransferTotalCost(),
                    balanceQuantity: destBalance.getQuantityOnHand(),
                    balanceValue: destBalance.getInventoryValue(),
                    balanceAverageCost: destBalance.getAverageCost(),
                    averageCostBefore: prevAvgCost,
                    averageCostAfter: destBalance.getAverageCost(),
                    inventoryValueBefore: prevValue,
                    inventoryValueAfter: destBalance.getInventoryValue(),
                    referenceType: ReferenceType.TRANSFER,
                    referenceId: transfer.getId(),
                    occurredAt: new Date(),
                });

                inboundLedgerEntries.push(inLedger);
                await tx.inventoryBalanceRepository.save(destBalance);
                lineNumber += 1;
            }

            const inRefVO = MovementReferenceVO.create(
                ReferenceType.TRANSFER,
                transfer.getId(),
            );

            const inboundMovement = InventoryMovement.create({
                id: inboundMovementId,
                tenantId: command.tenantId,
                warehouseId: transfer.getDestinationWarehouseId(),
                type: MovementType.TRANSFER_IN,
                status: MovementStatus.POSTED,
                source: MovementSource.TRANSFER,
                reference: inRefVO,
                notes: `Recepción física de traslado ${transfer.getReference().getValue()} desde bodega ${transfer.getSourceWarehouseId()}`,
                occurredAt: new Date(),
                lines: inboundLines,
            });

            await tx.inventoryMovementRepository.save(inboundMovement);
            await tx.inventoryLedgerRepository.saveMany(inboundLedgerEntries);

            transfer.receive(inboundMovementId, command.performedById);
            await tx.inventoryTransferRepository.save(transfer);

            const receiveResult: ReceiveTransferResult = {
                transferId: transfer.getId(),
                status: transfer.getStatus(),
                sourceWarehouseId: transfer.getSourceWarehouseId(),
                destinationWarehouseId: transfer.getDestinationWarehouseId(),
                inboundMovementId,
                completedAt: transfer.getCompletedAt() ?? new Date(),
            };

            if (command.idempotencyKey && tx.idempotencyRepository) {
                await tx.idempotencyRepository.save({
                    tenantId: command.tenantId,
                    key: command.idempotencyKey,
                    operation: 'RECEIVE_TRANSFER',
                    response: receiveResult,
                    resourceId: transfer.getId(),
                });
            }

            return receiveResult;
        });

        if (command.idempotencyKey) {
            await this.idempotencyPort.save({
                tenantId: command.tenantId,
                key: command.idempotencyKey,
                operation: 'RECEIVE_TRANSFER',
                response: result,
                resourceId: result.transferId,
            });
        }

        return result;
    } catch (error) {
        if (command.idempotencyKey && !(error instanceof IdempotencyConflictException)) {
            await this.idempotencyPort.release(command.tenantId, command.idempotencyKey).catch(() => {});
        }
        throw error;
    }
}
}
