import { MoneyVO } from '../../../domain/value-objects/money.vo';
import {
    ProductBarcodeAlreadyExistsException,
    ProductNotFoundException,
    UnitOfMeasureNotFoundException,
} from '../../exceptions';
import {
    UpdateProductCommand,
    UpdateProductResult,
    UpdateProductUseCase,
} from '../../ports/in/update-product.use-case';
import { ProductRepositoryPort } from '../../ports/out/product-repository.port';
import { UnitOfMeasureRepositoryPort } from '../../ports/out/unit-of-measure-repository.port';
import { UnitOfWorkPort } from '../../ports/out/unit-of-work.port';

export class UpdateProductService implements UpdateProductUseCase {
    constructor(
        private readonly productRepository: ProductRepositoryPort,
        private readonly unitOfMeasureRepository: UnitOfMeasureRepositoryPort,
        private readonly unitOfWork: UnitOfWorkPort,
    ) { }

    async execute(command: UpdateProductCommand): Promise<UpdateProductResult> {
        const product = await this.productRepository.findById(
            command.tenantId,
            command.productId,
        );

        if (!product) {
            throw new ProductNotFoundException(command.productId);
        }

        if (
            command.barcode !== undefined &&
            command.barcode !== null &&
            command.barcode.trim() !== '' &&
            command.barcode !== product.getBarcode()
        ) {
            const existing = await this.productRepository.findByBarcode(
                command.tenantId,
                command.barcode,
            );

            if (existing && existing.getId() !== product.getId()) {
                throw new ProductBarcodeAlreadyExistsException(command.barcode);
            }
        }

        if (
            command.unitOfMeasureId !== undefined &&
            command.unitOfMeasureId !== product.getUnitOfMeasureId()
        ) {
            const uom = await this.unitOfMeasureRepository.findById(
                command.tenantId,
                command.unitOfMeasureId,
            );

            if (!uom) {
                throw new UnitOfMeasureNotFoundException(command.unitOfMeasureId);
            }
        }

        product.updateCommercialInfo({
            name: command.name,
            description: command.description,
            barcode: command.barcode,
            categoryId: command.categoryId,
            salePrice:
                command.salePrice !== undefined
                    ? MoneyVO.create(command.salePrice, 'COP')
                    : undefined,
            wholesalePrice:
                command.wholesalePrice !== undefined
                    ? command.wholesalePrice !== null
                        ? MoneyVO.create(command.wholesalePrice, 'COP')
                        : null
                    : undefined,
            taxRate: command.taxRate,
            minStockAlert: command.minStockAlert,
            unitOfMeasureId: command.unitOfMeasureId,
        });

        if (command.costPrice !== undefined) {
            product.updateCostPrice(MoneyVO.create(command.costPrice, 'COP'));
        }

        if (command.isActive === true) {
            product.activate();
        } else if (command.isActive === false) {
            product.deactivate();
        }

        await this.unitOfWork.execute(async (tx) => {
            await tx.productRepository.save(product);
        });

        return {
            id: product.getId(),
            sku: product.getSku().getValue(),
            name: product.getName(),
            description: product.getDescription(),
            barcode: product.getBarcode(),
            categoryId: product.getCategoryId(),
            unitOfMeasureId: product.getUnitOfMeasureId(),
            costPrice: product.getCostPrice().getAmount().toFixed(4),
            salePrice: product.getSalePrice().getAmount().toFixed(2),
            wholesalePrice: product.getWholesalePrice()
                ? product.getWholesalePrice()!.getAmount().toFixed(2)
                : null,
            taxRate: product.getTaxRate().toFixed(2),
            minStockAlert: product.getMinStockAlert().toFixed(3),
            isActive: product.isActive(),
            updatedAt: product.getUpdatedAt(),
        };
    }
}
