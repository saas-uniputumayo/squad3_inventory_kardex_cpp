import { ProductNotFoundException } from '../../exceptions';
import { InventoryBalanceRepositoryPort } from '../../ports/out/inventory-balance-repository.port';
import { ProductRepositoryPort } from '../../ports/out/product-repository.port';
import { ProductVariantRepositoryPort } from '../../ports/out/product-variant-repository.port';
import { UnitOfMeasureRepositoryPort } from '../../ports/out/unit-of-measure-repository.port';
import {
    GetProductDetailQuery,
    GetProductDetailUseCase,
    ProductDetailResult,
} from '../../ports/in/get-product-detail.use-case';
import { ProductStockInfo } from '../../ports/in/search-products.use-case';

export class GetProductDetailService implements GetProductDetailUseCase {
    constructor(
        private readonly productRepository: ProductRepositoryPort,
        private readonly productVariantRepository: ProductVariantRepositoryPort,
        private readonly unitOfMeasureRepository: UnitOfMeasureRepositoryPort,
        private readonly inventoryBalanceRepository: InventoryBalanceRepositoryPort,
    ) { }

    async execute(query: GetProductDetailQuery): Promise<ProductDetailResult> {
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

        let stockInfo: ProductStockInfo | undefined;

        if (query.warehouseId) {
            const defaultVariant =
                await this.productVariantRepository.findDefaultByProductId(
                    query.tenantId,
                    product.getId(),
                );

            if (defaultVariant) {
                const balance =
                    await this.inventoryBalanceRepository.findByLocation(
                        query.tenantId,
                        query.warehouseId,
                        product.getId(),
                        defaultVariant.getId(),
                    );

                if (balance) {
                    stockInfo = {
                        quantityOnHand: balance
                            .getQuantityOnHand()
                            .getAmount()
                            .toFixed(balance.getDecimalPlaces()),
                        reservedQuantity: balance
                            .getReservedQuantity()
                            .getAmount()
                            .toFixed(balance.getDecimalPlaces()),
                        availableQuantity: balance
                            .getAvailableQuantity()
                            .getAmount()
                            .toFixed(balance.getDecimalPlaces()),
                        averageCost: balance
                            .getAverageCost()
                            .getAmount()
                            .toFixed(6),
                        inventoryValue: balance
                            .getInventoryValue()
                            .getAmount()
                            .toFixed(4),
                    };
                }
            }
        }

        return {
            id: product.getId(),
            sku: product.getSku().getValue(),
            barcode: product.getBarcode(),
            name: product.getName(),
            description: product.getDescription(),
            categoryId: product.getCategoryId(),
            unitOfMeasure: {
                id: product.getUnitOfMeasureId(),
                code: uom ? uom.getCode().toString() : '',
                name: uom ? uom.getName() : '',
            },
            costPrice: product.getCostPrice().getAmount().toFixed(4),
            salePrice: product.getSalePrice().getAmount().toFixed(2),
            wholesalePrice: product.getWholesalePrice()
                ? product.getWholesalePrice()!.getAmount().toFixed(2)
                : null,
            taxRate: product.getTaxRate().toFixed(2),
            minStockAlert: product.getMinStockAlert().toFixed(3),
            isActive: product.isActive(),
            stock: stockInfo,
            createdAt: product.getCreatedAt(),
            updatedAt: product.getUpdatedAt(),
        };
    }
}
