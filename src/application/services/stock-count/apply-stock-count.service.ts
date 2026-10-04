import { randomUUID } from 'node:crypto';
import Decimal from 'decimal.js';
import { InventoryBalance } from '../../../domain/entities/inventory-balance/entity';
import { InventoryMovement } from '../../../domain/entities/inventory-movement/entity';
import { InventoryMovementLine } from '../../../domain/entities/inventory-movement/line.entity';
import { InventoryLedgerEntry } from '../../../domain/entities/inventory-ledger-entry/entity';
import { StockCountLine } from '../../../domain/entities/stock-count/line.entity';
import { InvalidStockCountException } from '../../../domain/exceptions/invalid-stock-count.exception';
import {
    MovementSource,
    MovementStatus,
    MovementType,
    ReferenceType,
    StockCountStatus,
} from '../../../domain/types';
import { MovementReferenceVO } from '../../../domain/value-objects/movement-reference.vo';
import { QuantityVO } from '../../../domain/value-objects/quantity.vo';
import { UnitCostVO } from '../../../domain/value-objects/unit-cost.vo';
import { MoneyVO } from '../../../domain/value-objects/money.vo';
import { InvalidInventoryBalanceException } from '../../../domain/exceptions/invalid-inventory-balance.exception';
import { InvalidWarehouseException } from '../../../domain/exceptions/invalid-warehouse.exception';
import {
    IdempotencyConflictException,
    StockCountNotFoundException,
    WarehouseNotFoundException,
} from '../../exceptions';
import {
    AppliedAdjustmentLineResult,
    ApplyStockCountCommand,
    ApplyStockCountResult,
    ApplyStockCountUseCase,
} from '../../ports/in/apply-stock-count.use-case';
import {
    IdempotencyPort,
    IdempotencyStatus,
} from '../../ports/out/idempotency.port';
import { StockCountRepositoryPort } from '../../ports/out/stock-count-repository.port';
import { UnitOfWorkPort } from '../../ports/out/unit-of-work.port';
import { WarehouseRepositoryPort } from '../../ports/out/warehouse-repository.port';

export class ApplyStockCountService implements ApplyStockCountUseCase {
    constructor(
        private readonly warehouseRepository: WarehouseRepositoryPort,
        private readonly stockCountRepository: StockCountRepositoryPort,
        private readonly idempotencyPort: IdempotencyPort,
        private readonly unitOfWork: UnitOfWorkPort,
    ) { }

    async execute(command: ApplyStockCountCommand): Promise<ApplyStockCountResult> {
        if (command.idempotencyKey) {
            const cached = await this.idempotencyPort.get<ApplyStockCountResult>(
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
                        'APPLY_STOCK_COUNT',
                    );
                }
            }
        }

        const result = await this.unitOfWork.execute(async (tx) => {
            const stockCount = await tx.stockCountRepository.findById(
                command.tenantId,
                command.stockCountId,
            );

            if (!stockCount) {
                throw new StockCountNotFoundException(command.stockCountId);
            }

            const warehouse = await this.warehouseRepository.findById(
                command.tenantId,
                stockCount.getWarehouseId(),
            );

            if (!warehouse) {
                throw new WarehouseNotFoundException(stockCount.getWarehouseId());
            }

            if (!warehouse.canPerformInventoryOperations()) {
                throw new InvalidWarehouseException(
                    `La bodega '${stockCount.getWarehouseId()}' no se encuentra activa u operativa para aplicar ajustes`,
                );
            }

            // Si está en borrador, iniciamos el conteo
            if (stockCount.isDraft()) {
                stockCount.startCounting();
            }

            // Aplicamos los conteos suministrados
            if (command.counts && command.counts.length > 0) {
                const countMap = new Map(
                    command.counts.map((c) => [c.lineId, c]),
                );

                for (const line of stockCount.getLines()) {
                    const countInput = countMap.get(line.getId());
                    if (countInput && line.isPending()) {
                        const qtyVO = QuantityVO.create(countInput.countedQuantity, {
                            unitOfMeasureId: line.getUnitOfMeasureId(),
                            allowsFraction: line.getAllowsFraction(),
                            decimalPlaces: line.getDecimalPlaces(),
                        });
                        line.count(qtyVO, countInput.notes);
                    }
                }
            }

            // Validar que todas las líneas hayan sido contadas
            if (!stockCount.areAllLinesCounted()) {
                throw new InvalidStockCountException(
                    'No se puede aplicar un conteo físico que contenga líneas pendientes de conteo',
                );
            }

            const linesWithDifferences = stockCount.getLinesWithDifferences();

            // Orden determinista para bloqueos
            const sortedDiffLines = [...linesWithDifferences].sort((a, b) => {
                const pComp = a.getProductId().localeCompare(b.getProductId());
                if (pComp !== 0) return pComp;
                return a.getVariantId().localeCompare(b.getVariantId());
            });

            const surplusLines: Array<{
                line: StockCountLine;
                balance: InventoryBalance;
                diffAmount: Decimal;
            }> = [];

            const shortageLines: Array<{
                line: StockCountLine;
                balance: InventoryBalance;
                diffAmount: Decimal;
            }> = [];

            for (const diffLine of sortedDiffLines) {
                let balance = await tx.inventoryBalanceRepository.findForUpdate(
                    command.tenantId,
                    stockCount.getWarehouseId(),
                    diffLine.getProductId(),
                    diffLine.getVariantId(),
                );

                if (!balance) {
                    if (diffLine.isSurplus()) {
                        balance = InventoryBalance.create({
                            id: randomUUID(),
                            tenantId: command.tenantId,
                            warehouseId: stockCount.getWarehouseId(),
                            productId: diffLine.getProductId(),
                            variantId: diffLine.getVariantId(),
                            unitOfMeasureId: diffLine.getUnitOfMeasureId(),
                            allowsFraction: diffLine.getAllowsFraction(),
                            decimalPlaces: diffLine.getDecimalPlaces(),
                        });
                    } else {
                        throw new InvalidInventoryBalanceException(
                            `No hay existencias suficientes para registrar el ajuste de faltante en producto '${diffLine.getProductId()}'`,
                        );
                    }
                }

                if (diffLine.isSurplus()) {
                    surplusLines.push({
                        line: diffLine,
                        balance,
                        diffAmount: diffLine.getAbsDifferenceAmount(),
                    });
                } else if (diffLine.isShortage()) {
                    shortageLines.push({
                        line: diffLine,
                        balance,
                        diffAmount: diffLine.getAbsDifferenceAmount(),
                    });
                }
            }

            const now = new Date();
            let surplusMovementId: string | undefined;
            let shortageMovementId: string | undefined;

            // Procesar Sobrantes (ADJUSTMENT_IN)
            if (surplusLines.length > 0) {
                surplusMovementId = randomUUID();
                const movLines: InventoryMovementLine[] = [];
                const ledgerEntries: InventoryLedgerEntry[] = [];
                let lineNum = 1;

                for (const item of surplusLines) {
                    const prevAvgCost = item.balance.getAverageCost();
                    const prevValue = item.balance.getInventoryValue();
                    const unitCostAmount = prevAvgCost.getAmount();

                    const qtyVO = QuantityVO.create(item.diffAmount, {
                        unitOfMeasureId: item.balance.getUnitOfMeasureId(),
                        allowsFraction: item.balance.getAllowsFraction(),
                        decimalPlaces: item.balance.getDecimalPlaces(),
                    });
                    const costVO = UnitCostVO.create(unitCostAmount, item.balance.getCurrency());

                    // El sobrante entra al costo promedio actual del balance
                    item.balance.receive(qtyVO, costVO);

                    const lineId = randomUUID();
                    const totalCost = unitCostAmount.times(item.diffAmount);

                    const movLine = InventoryMovementLine.create({
                        id: lineId,
                        movementId: surplusMovementId,
                        productId: item.line.getProductId(),
                        variantId: item.line.getVariantId(),
                        unitOfMeasureId: item.balance.getUnitOfMeasureId(),
                        allowsFraction: item.balance.getAllowsFraction(),
                        decimalPlaces: item.balance.getDecimalPlaces(),
                        currency: item.balance.getCurrency(),
                        quantity: item.diffAmount,
                        unitCost: unitCostAmount,
                        totalCost,
                        lineNumber: lineNum,
                    });
                    movLines.push(movLine);

                    const ledger = InventoryLedgerEntry.create({
                        id: randomUUID(),
                        tenantId: command.tenantId,
                        warehouseId: stockCount.getWarehouseId(),
                        movementId: surplusMovementId,
                        movementLineId: lineId,
                        productId: item.line.getProductId(),
                        variantId: item.line.getVariantId(),
                        unitOfMeasureId: item.balance.getUnitOfMeasureId(),
                        allowsFraction: item.balance.getAllowsFraction(),
                        decimalPlaces: item.balance.getDecimalPlaces(),
                        currency: item.balance.getCurrency(),
                        movementType: MovementType.ADJUSTMENT_IN,
                        source: MovementSource.STOCK_COUNT,
                        quantityIn: QuantityVO.create(item.diffAmount, {
                            unitOfMeasureId: item.balance.getUnitOfMeasureId(),
                            allowsFraction: item.balance.getAllowsFraction(),
                            decimalPlaces: item.balance.getDecimalPlaces(),
                        }),
                        unitCost: UnitCostVO.create(unitCostAmount, item.balance.getCurrency()),
                        totalValue: MoneyVO.create(totalCost, item.balance.getCurrency()),
                        balanceQuantity: item.balance.getQuantityOnHand(),
                        balanceValue: item.balance.getInventoryValue(),
                        balanceAverageCost: item.balance.getAverageCost(),
                        averageCostBefore: prevAvgCost,
                        averageCostAfter: item.balance.getAverageCost(),
                        inventoryValueBefore: prevValue,
                        inventoryValueAfter: item.balance.getInventoryValue(),
                        referenceType: ReferenceType.STOCK_COUNT,
                        referenceId: stockCount.getId(),
                        occurredAt: now,
                    });
                    ledgerEntries.push(ledger);

                    await tx.inventoryBalanceRepository.save(item.balance);
                    item.line.markAsApplied();
                    lineNum += 1;
                }

                const surplusMovement = InventoryMovement.create({
                    id: surplusMovementId,
                    tenantId: command.tenantId,
                    warehouseId: stockCount.getWarehouseId(),
                    type: MovementType.ADJUSTMENT_IN,
                    status: MovementStatus.POSTED,
                    source: MovementSource.STOCK_COUNT,
                    reference: MovementReferenceVO.create(
                        ReferenceType.STOCK_COUNT,
                        stockCount.getId(),
                    ),
                    notes: `Ajuste por sobrante físico - Conteo ${stockCount.getId()}`,
                    occurredAt: now,
                    lines: movLines,
                });

                await tx.inventoryMovementRepository.save(surplusMovement);
                await tx.inventoryLedgerRepository.saveMany(ledgerEntries);
            }

            // Procesar Faltantes (ADJUSTMENT_OUT)
            if (shortageLines.length > 0) {
                shortageMovementId = randomUUID();
                const movLines: InventoryMovementLine[] = [];
                const ledgerEntries: InventoryLedgerEntry[] = [];
                let lineNum = 1;

                for (const item of shortageLines) {
                    const prevAvgCost = item.balance.getAverageCost();
                    const prevValue = item.balance.getInventoryValue();

                    const shortageQtyVO = QuantityVO.create(item.diffAmount, {
                        unitOfMeasureId: item.balance.getUnitOfMeasureId(),
                        allowsFraction: item.balance.getAllowsFraction(),
                        decimalPlaces: item.balance.getDecimalPlaces(),
                    });

                    const dispatchValue = item.balance.dispatch(shortageQtyVO);

                    const lineId = randomUUID();
                    const movLine = InventoryMovementLine.create({
                        id: lineId,
                        movementId: shortageMovementId,
                        productId: item.line.getProductId(),
                        variantId: item.line.getVariantId(),
                        unitOfMeasureId: item.balance.getUnitOfMeasureId(),
                        allowsFraction: item.balance.getAllowsFraction(),
                        decimalPlaces: item.balance.getDecimalPlaces(),
                        currency: item.balance.getCurrency(),
                        quantity: item.diffAmount,
                        unitCost: prevAvgCost.getAmount(),
                        totalCost: dispatchValue.getAmount(),
                        lineNumber: lineNum,
                    });
                    movLines.push(movLine);

                    const ledger = InventoryLedgerEntry.create({
                        id: randomUUID(),
                        tenantId: command.tenantId,
                        warehouseId: stockCount.getWarehouseId(),
                        movementId: shortageMovementId,
                        movementLineId: lineId,
                        productId: item.line.getProductId(),
                        variantId: item.line.getVariantId(),
                        unitOfMeasureId: item.balance.getUnitOfMeasureId(),
                        allowsFraction: item.balance.getAllowsFraction(),
                        decimalPlaces: item.balance.getDecimalPlaces(),
                        currency: item.balance.getCurrency(),
                        movementType: MovementType.ADJUSTMENT_OUT,
                        source: MovementSource.STOCK_COUNT,
                        quantityOut: shortageQtyVO,
                        unitCost: prevAvgCost,
                        totalValue: dispatchValue,
                        balanceQuantity: item.balance.getQuantityOnHand(),
                        balanceValue: item.balance.getInventoryValue(),
                        balanceAverageCost: item.balance.getAverageCost(),
                        averageCostBefore: prevAvgCost,
                        averageCostAfter: item.balance.getAverageCost(),
                        inventoryValueBefore: prevValue,
                        inventoryValueAfter: item.balance.getInventoryValue(),
                        referenceType: ReferenceType.STOCK_COUNT,
                        referenceId: stockCount.getId(),
                        occurredAt: now,
                    });
                    ledgerEntries.push(ledger);

                    await tx.inventoryBalanceRepository.save(item.balance);
                    item.line.markAsApplied();
                    lineNum += 1;
                }

                const shortageMovement = InventoryMovement.create({
                    id: shortageMovementId,
                    tenantId: command.tenantId,
                    warehouseId: stockCount.getWarehouseId(),
                    type: MovementType.ADJUSTMENT_OUT,
                    status: MovementStatus.POSTED,
                    source: MovementSource.STOCK_COUNT,
                    reference: MovementReferenceVO.create(
                        ReferenceType.STOCK_COUNT,
                        stockCount.getId(),
                    ),
                    notes: `Ajuste por faltante físico - Conteo ${stockCount.getId()}`,
                    occurredAt: now,
                    lines: movLines,
                });

                await tx.inventoryMovementRepository.save(shortageMovement);
                await tx.inventoryLedgerRepository.saveMany(ledgerEntries);
            }

            // Marcar las líneas sin diferencia como aplicadas
            for (const line of stockCount.getLines()) {
                if (line.isCounted() && !line.hasDifference()) {
                    line.markAsApplied();
                }
            }

            stockCount.complete();
            await tx.stockCountRepository.save(stockCount);

            const linesResult: AppliedAdjustmentLineResult[] = stockCount
                .getLines()
                .map((l) => {
                    const diffAmt = l.getDifferenceAmount();
                    let adjType: 'SURPLUS' | 'SHORTAGE' | 'EQUAL' = 'EQUAL';
                    let movId: string | undefined;

                    if (diffAmt.greaterThan(0)) {
                        adjType = 'SURPLUS';
                        movId = surplusMovementId;
                    } else if (diffAmt.lessThan(0)) {
                        adjType = 'SHORTAGE';
                        movId = shortageMovementId;
                    }

                    return {
                        productId: l.getProductId(),
                        variantId: l.getVariantId(),
                        systemQuantity: l
                            .getSystemQuantity()
                            .getAmount()
                            .toFixed(l.getDecimalPlaces()),
                        countedQuantity: l
                            .getCountedQuantity()!
                            .getAmount()
                            .toFixed(l.getDecimalPlaces()),
                        differenceQuantity: diffAmt.toFixed(l.getDecimalPlaces()),
                        adjustmentType: adjType,
                        movementId: movId,
                    };
                });

            return {
                stockCountId: stockCount.getId(),
                status: stockCount.getStatus(),
                totalLines: stockCount.getLines().length,
                adjustedLines: linesWithDifferences.length,
                lines: linesResult,
                completedAt: stockCount.getCompletedAt() ?? now,
            };
        });

        if (command.idempotencyKey) {
            await this.idempotencyPort.save({
                tenantId: command.tenantId,
                key: command.idempotencyKey,
                operation: 'APPLY_STOCK_COUNT',
                response: result,
            });
        }

        return result;
    }
}
