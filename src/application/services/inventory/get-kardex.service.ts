import { ProductNotFoundException } from '../../exceptions';
import { InventoryLedgerRepositoryPort } from '../../ports/out/inventory-ledger-repository.port';
import { ProductRepositoryPort } from '../../ports/out/product-repository.port';
import { UnitOfMeasureRepositoryPort } from '../../ports/out/unit-of-measure-repository.port';
import { WarehouseRepositoryPort } from '../../ports/out/warehouse-repository.port';
import {
    GetKardexQuery,
    GetKardexUseCase,
    KardexEntryResult,
    KardexResult,
} from '../../ports/in/get-kardex.use-case';

export class GetKardexService implements GetKardexUseCase {
    constructor(
        private readonly productRepository: ProductRepositoryPort,
        private readonly warehouseRepository: WarehouseRepositoryPort,
        private readonly unitOfMeasureRepository: UnitOfMeasureRepositoryPort,
        private readonly inventoryLedgerRepository: InventoryLedgerRepositoryPort,
    ) { }

    async execute(query: GetKardexQuery): Promise<KardexResult> {
        const product = await this.productRepository.findById(
            query.tenantId,
            query.productId,
        );

        if (!product) {
            throw new ProductNotFoundException(query.productId);
        }

        const uom = await this.unitOfMeasureRepository.findById(
            query.tenantId,
            product.getUnitOfMeasureId(),
        );

        let warehouseInfo: { id: string; name: string } | undefined;

        if (query.warehouseId) {
            const warehouse = await this.warehouseRepository.findById(
                query.tenantId,
                query.warehouseId,
            );

            if (warehouse) {
                warehouseInfo = {
                    id: warehouse.getId(),
                    name: warehouse.getName(),
                };
            }
        }

        const page = Math.max(1, query.page ?? 1);
        const limit = Math.max(1, Math.min(100, query.limit ?? 50));

        const { entries, total } =
            await this.inventoryLedgerRepository.findByProduct(query.tenantId, {
                productId: query.productId,
                variantId: query.variantId,
                warehouseId: query.warehouseId,
                from: query.from,
                to: query.to,
                movementType: query.movementType,
                page,
                limit,
            });

        const formattedEntries: KardexEntryResult[] = entries.map((entry) => ({
            id: entry.getId(),
            sequence: entry.getSequence() !== null ? entry.getSequence()!.toString() : null,
            date: entry.getOccurredAt(),
            movementId: entry.getMovementId(),
            movementType: entry.getMovementType(),
            referenceType: entry.getReferenceType(),
            referenceDocument: entry.getReferenceDocument(),
            quantityIn: entry.getQuantityIn()
                ? entry
                    .getQuantityIn()!
                    .getAmount()
                    .toFixed(entry.getDecimalPlaces())
                : '0',
            quantityOut: entry.getQuantityOut()
                ? entry
                    .getQuantityOut()!
                    .getAmount()
                    .toFixed(entry.getDecimalPlaces())
                : '0',
            quantityBalance: entry
                .getBalanceQuantity()
                .getAmount()
                .toFixed(entry.getDecimalPlaces()),
            unitCost: entry.getUnitCost().getAmount().toFixed(6),
            averageCost: entry.getBalanceAverageCost().getAmount().toFixed(6),
            inventoryValue: entry.getBalanceValue().getAmount().toFixed(4),
        }));

        const totalPages = Math.ceil(total / limit);

        return {
            product: {
                id: product.getId(),
                sku: product.getSku().getValue(),
                name: product.getName(),
                unitOfMeasure: uom ? uom.getCode().toString() : '',
            },
            warehouse: warehouseInfo,
            entries: formattedEntries,
            pagination: {
                page,
                limit,
                total,
                totalPages,
            },
        };
    }
}
