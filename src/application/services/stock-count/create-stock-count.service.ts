import { randomUUID } from 'node:crypto';
import { StockCount } from '../../../domain/entities/stock-count/entity';
import { StockCountLine } from '../../../domain/entities/stock-count/line.entity';
import { InvalidWarehouseException } from '../../../domain/exceptions/invalid-warehouse.exception';
import { QuantityVO } from '../../../domain/value-objects/quantity.vo';
import { WarehouseNotFoundException } from '../../exceptions';
import {
    CreateStockCountCommand,
    CreateStockCountResult,
    CreateStockCountUseCase,
} from '../../ports/in/create-stock-count.use-case';
import { InventoryBalanceRepositoryPort } from '../../ports/out/inventory-balance-repository.port';
import { StockCountRepositoryPort } from '../../ports/out/stock-count-repository.port';
import { WarehouseRepositoryPort } from '../../ports/out/warehouse-repository.port';

export class CreateStockCountService implements CreateStockCountUseCase {
    constructor(
        private readonly warehouseRepository: WarehouseRepositoryPort,
        private readonly inventoryBalanceRepository: InventoryBalanceRepositoryPort,
        private readonly stockCountRepository: StockCountRepositoryPort,
    ) { }

    async execute(command: CreateStockCountCommand): Promise<CreateStockCountResult> {
        const warehouse = await this.warehouseRepository.findById(
            command.tenantId,
            command.warehouseId,
        );

        if (!warehouse) {
            throw new WarehouseNotFoundException(command.warehouseId);
        }

        if (!warehouse.canPerformInventoryOperations()) {
            throw new InvalidWarehouseException(
                `La bodega '${command.warehouseId}' no se encuentra activa u operativa para realizar conteos`,
            );
        }

        const stockCountId = randomUUID();
        const stockCount = StockCount.create({
            id: stockCountId,
            tenantId: command.tenantId,
            warehouseId: command.warehouseId,
            notes: command.notes,
        });

        let balances = await this.inventoryBalanceRepository.findByWarehouse(
            command.tenantId,
            command.warehouseId,
        );

        if (command.productIds && command.productIds.length > 0) {
            const productIdsSet = new Set(command.productIds);
            balances = balances.filter((b) => productIdsSet.has(b.getProductId()));
        }

        for (const balance of balances) {
            const systemQty = QuantityVO.create(balance.getQuantityOnHand().getAmount(), {
                unitOfMeasureId: balance.getUnitOfMeasureId(),
                allowsFraction: balance.getAllowsFraction(),
                decimalPlaces: balance.getDecimalPlaces(),
            });

            const line = StockCountLine.create({
                id: randomUUID(),
                stockCountId,
                productId: balance.getProductId(),
                variantId: balance.getVariantId(),
                unitOfMeasureId: balance.getUnitOfMeasureId(),
                allowsFraction: balance.getAllowsFraction(),
                decimalPlaces: balance.getDecimalPlaces(),
                systemQuantity: systemQty,
            });

            stockCount.addLine(line);
        }

        if (command.autoStart && stockCount.getLines().length > 0) {
            stockCount.startCounting();
        }

        await this.stockCountRepository.save(stockCount);

        const linesResult = stockCount.getLines().map((l) => ({
            id: l.getId(),
            productId: l.getProductId(),
            variantId: l.getVariantId(),
            systemQuantity: l
                .getSystemQuantity()
                .getAmount()
                .toFixed(l.getDecimalPlaces()),
        }));

        return {
            id: stockCount.getId(),
            warehouseId: stockCount.getWarehouseId(),
            status: stockCount.getStatus(),
            linesCount: linesResult.length,
            lines: linesResult,
            createdAt: stockCount.getCreatedAt(),
            startedAt: stockCount.getStartedAt(),
        };
    }
}
