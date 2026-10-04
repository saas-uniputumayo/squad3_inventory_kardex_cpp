import Decimal from 'decimal.js';
import { InventoryBalanceRepositoryPort } from '../../ports/out/inventory-balance-repository.port';
import {
    GetStockAlertsQuery,
    GetStockAlertsUseCase,
    StockAlertItemResult,
    StockAlertsResult,
} from '../../ports/in/get-stock-alerts.use-case';

export class GetStockAlertsService implements GetStockAlertsUseCase {
    constructor(
        private readonly inventoryBalanceRepository: InventoryBalanceRepositoryPort,
    ) { }

    async execute(query: GetStockAlertsQuery): Promise<StockAlertsResult> {
        const { items, total } =
            await this.inventoryBalanceRepository.findLowStockAlerts(
                query.tenantId,
                {
                    warehouseId: query.warehouseId,
                    search: query.search,
                    page: query.page,
                    limit: query.limit,
                },
            );

        const data: StockAlertItemResult[] = items.map((item) => {
            const minStock = item.product.getMinStockAlert();
            const available = item.balance.getAvailableQuantity().getAmount();
            const shortage = Decimal.max(0, minStock.minus(available));

            return {
                productId: item.product.getId(),
                variantId: item.variant.getId(),
                sku: item.variant.getSku().getValue(),
                barcode: item.product.getBarcode(),
                name: item.product.getName(),
                unitOfMeasure: item.balance.getUnitOfMeasureId(),
                warehouseId: item.warehouse.getId(),
                warehouseName: item.warehouse.getName(),
                currentStock: item.balance
                    .getQuantityOnHand()
                    .getAmount()
                    .toFixed(item.balance.getDecimalPlaces()),
                reservedStock: item.balance
                    .getReservedQuantity()
                    .getAmount()
                    .toFixed(item.balance.getDecimalPlaces()),
                availableStock: available.toFixed(item.balance.getDecimalPlaces()),
                minimumStock: minStock.toFixed(item.balance.getDecimalPlaces()),
                shortage: shortage.toFixed(item.balance.getDecimalPlaces()),
                salePrice: item.product.getSalePrice().getAmount().toFixed(2),
            };
        });

        return {
            data,
            meta: {
                total,
            },
        };
    }
}
