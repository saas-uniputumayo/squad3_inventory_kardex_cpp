import { randomUUID } from 'node:crypto';
import { InventoryMovement } from '../../../domain/entities/inventory-movement/entity';
import { InventoryMovementLine } from '../../../domain/entities/inventory-movement/line.entity';
import { InventoryLedgerEntry } from '../../../domain/entities/inventory-ledger-entry/entity';
import { InvalidInventoryMovementException } from '../../../domain/exceptions/invalid-inventory-movement.exception';
import {
    MovementSource,
    MovementStatus,
    MovementType,
    ReferenceType,
} from '../../../domain/types';
import { MovementReferenceVO } from '../../../domain/value-objects/movement-reference.vo';
import {
    IdempotencyConflictException,
    MovementNotFoundException,
} from '../../exceptions';
import {
    ReversalLineResult,
    ReverseMovementCommand,
    ReverseMovementResult,
    ReverseMovementUseCase,
} from '../../ports/in/reverse-movement.use-case';
import {
    IdempotencyPort,
    IdempotencyStatus,
} from '../../ports/out/idempotency.port';
import { UnitOfWorkPort } from '../../ports/out/unit-of-work.port';

export class ReverseMovementService implements ReverseMovementUseCase {
    constructor(
        private readonly idempotencyPort: IdempotencyPort,
        private readonly unitOfWork: UnitOfWorkPort,
    ) { }

    async execute(command: ReverseMovementCommand): Promise<ReverseMovementResult> {
        if (command.idempotencyKey) {
            const cached = await this.idempotencyPort.get<ReverseMovementResult>(
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
                        'REVERSE_MOVEMENT',
                    );
                }
            }
        }

        const reversalMovementId = randomUUID();
        const reversalLines: InventoryMovementLine[] = [];
        const ledgerEntries: InventoryLedgerEntry[] = [];
        const lineResults: ReversalLineResult[] = [];

        const result = await this.unitOfWork.execute(async (tx) => {
            const originalMovement = await tx.inventoryMovementRepository.findById(
                command.tenantId,
                command.movementId,
            );

            if (!originalMovement) {
                throw new MovementNotFoundException(command.movementId);
            }

            // Domain enforces status invariants on markAsReversed (must be POSTED, not REVERSED)
            originalMovement.markAsReversed(reversalMovementId);

            const isOriginalOutbound = originalMovement.isOutbound();
            const reversalType = isOriginalOutbound
                ? MovementType.VOID_RETURN
                : MovementType.SUPPLIER_RETURN;

            let lineNumber = 1;

            const sortedOriginalLines = [...originalMovement.getLines()].sort((a, b) =>
                a.getProductId().localeCompare(b.getProductId()) ||
                a.getVariantId().localeCompare(b.getVariantId()),
            );

            for (const origLine of sortedOriginalLines) {
                const balance = await tx.inventoryBalanceRepository.findForUpdate(
                    command.tenantId,
                    originalMovement.getWarehouseId(),
                    origLine.getProductId(),
                    origLine.getVariantId(),
                );

                if (!balance) {
                    throw new InvalidInventoryMovementException(
                        `No se encontró balance de inventario para revertir el producto ${origLine.getProductId()}`,
                    );
                }

                const previousStock = balance.getQuantityOnHand();
                const previousAverageCost = balance.getAverageCost();
                const previousInventoryValue = balance.getInventoryValue();

                if (isOriginalOutbound) {
                    // Restaurar existencias que habían salido
                    balance.receive(origLine.getQuantity(), origLine.getUnitCost());
                } else {
                    // Retirar existencias que habían entrado
                    balance.dispatch(origLine.getQuantity());
                }

                const reversalLineId = randomUUID();

                const revLine = InventoryMovementLine.create({
                    id: reversalLineId,
                    movementId: reversalMovementId,
                    productId: origLine.getProductId(),
                    variantId: origLine.getVariantId(),
                    unitOfMeasureId: origLine.getUnitOfMeasureId(),
                    allowsFraction: origLine.getAllowsFraction(),
                    decimalPlaces: origLine.getDecimalPlaces(),
                    currency: origLine.getCurrency(),
                    quantity: origLine.getQuantity().getAmount(),
                    unitCost: origLine.getUnitCost().getAmount(),
                    totalCost: origLine.getTotalCost().getAmount(),
                    lineNumber,
                });

                lineNumber += 1;
                reversalLines.push(revLine);

                const ledgerEntry = InventoryLedgerEntry.create({
                    id: randomUUID(),
                    tenantId: command.tenantId,
                    warehouseId: originalMovement.getWarehouseId(),
                    movementId: reversalMovementId,
                    movementLineId: reversalLineId,
                    productId: origLine.getProductId(),
                    variantId: origLine.getVariantId(),
                    unitOfMeasureId: origLine.getUnitOfMeasureId(),
                    allowsFraction: origLine.getAllowsFraction(),
                    decimalPlaces: origLine.getDecimalPlaces(),
                    currency: origLine.getCurrency(),
                    movementType: reversalType,
                    source: MovementSource.RETURN,
                    quantityIn: isOriginalOutbound ? origLine.getQuantity() : undefined,
                    quantityOut: !isOriginalOutbound ? origLine.getQuantity() : undefined,
                    unitCost: origLine.getUnitCost(),
                    totalValue: origLine.getTotalCost(),
                    balanceQuantity: balance.getQuantityOnHand(),
                    balanceValue: balance.getInventoryValue(),
                    balanceAverageCost: balance.getAverageCost(),
                    averageCostBefore: previousAverageCost,
                    averageCostAfter: balance.getAverageCost(),
                    inventoryValueBefore: previousInventoryValue,
                    inventoryValueAfter: balance.getInventoryValue(),
                    referenceType: command.referenceType ?? ReferenceType.POS_VOID,
                    referenceId: command.referenceId,
                    referenceDocument: command.referenceDocument ?? originalMovement.getId(),
                });

                ledgerEntries.push(ledgerEntry);

                lineResults.push({
                    productId: origLine.getProductId(),
                    variantId: origLine.getVariantId(),
                    quantityRestored: origLine
                        .getQuantity()
                        .getAmount()
                        .toFixed(balance.getDecimalPlaces()),
                    newStock: balance
                        .getQuantityOnHand()
                        .getAmount()
                        .toFixed(balance.getDecimalPlaces()),
                    newAverageCost: balance.getAverageCost().getAmount().toFixed(6),
                });

                await tx.inventoryBalanceRepository.save(balance);
            }

            const refId = command.referenceId ?? command.referenceDocument ?? originalMovement.getId();
            const referenceVO = MovementReferenceVO.create(
                command.referenceType ?? ReferenceType.POS_VOID,
                refId,
            );

            const reversalMovement = InventoryMovement.create({
                id: reversalMovementId,
                tenantId: command.tenantId,
                warehouseId: originalMovement.getWarehouseId(),
                type: reversalType,
                status: MovementStatus.POSTED,
                source: MovementSource.RETURN,
                reference: referenceVO,
                notes: `Reversa del movimiento ${originalMovement.getId()}. Razón: ${command.reason}`,
                lines: reversalLines,
            });

            await tx.inventoryMovementRepository.save(originalMovement);
            await tx.inventoryMovementRepository.save(reversalMovement);
            await tx.inventoryLedgerRepository.saveMany(ledgerEntries);

            const reversalResult: ReverseMovementResult = {
                reversedMovementId: originalMovement.getId(),
                reversalMovementId,
                status: MovementStatus.POSTED,
                reason: command.reason,
                lines: lineResults,
                createdAt: reversalMovement.getCreatedAt(),
            };

            return reversalResult;
        });

        if (command.idempotencyKey) {
            await this.idempotencyPort.save({
                tenantId: command.tenantId,
                key: command.idempotencyKey,
                operation: 'REVERSE_MOVEMENT',
                response: result,
                resourceId: reversalMovementId,
            });
        }

        return result;
    }
}
