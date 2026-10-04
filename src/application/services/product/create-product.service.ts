import { randomUUID } from 'node:crypto';
import { Product } from '../../../domain/entities/product/entity';
import { ProductVariant } from '../../../domain/entities/product/variant.entity';
import {
    CostMethod,
    ProductStructure,
    ProductType,
} from '../../../domain/types';
import { MoneyVO } from '../../../domain/value-objects/money.vo';
import { SkuVO } from '../../../domain/value-objects/sku.vo';
import {
    ProductBarcodeAlreadyExistsException,
    ProductSkuAlreadyExistsException,
    UnitOfMeasureNotFoundException,
} from '../../exceptions';
import {
    CreateProductCommand,
    CreateProductResult,
    CreateProductUseCase,
} from '../../ports/in/create-product.use-case';
import { ProductRepositoryPort } from '../../ports/out/product-repository.port';
import { ProductVariantRepositoryPort } from '../../ports/out/product-variant-repository.port';
import { UnitOfMeasureRepositoryPort } from '../../ports/out/unit-of-measure-repository.port';
import { UnitOfWorkPort } from '../../ports/out/unit-of-work.port';

export class CreateProductService implements CreateProductUseCase {
    constructor(
        private readonly productRepository: ProductRepositoryPort,
        private readonly productVariantRepository: ProductVariantRepositoryPort,
        private readonly unitOfMeasureRepository: UnitOfMeasureRepositoryPort,
        private readonly unitOfWork: UnitOfWorkPort,
    ) { }

    async execute(command: CreateProductCommand): Promise<CreateProductResult> {
        const skuVO = SkuVO.create(command.sku);

        const existingBySku = await this.productRepository.findBySku(
            command.tenantId,
            skuVO.getValue(),
        );

        if (existingBySku) {
            throw new ProductSkuAlreadyExistsException(skuVO.getValue());
        }

        if (command.barcode) {
            const existingByBarcode = await this.productRepository.findByBarcode(
                command.tenantId,
                command.barcode,
            );

            if (existingByBarcode) {
                throw new ProductBarcodeAlreadyExistsException(command.barcode);
            }
        }

        const uom = await this.unitOfMeasureRepository.findById(
            command.tenantId,
            command.unitOfMeasureId,
        );

        if (!uom) {
            throw new UnitOfMeasureNotFoundException(command.unitOfMeasureId);
        }

        const productId = randomUUID();
        const structure = command.structure ?? ProductStructure.SIMPLE;

        const product = Product.create({
            id: productId,
            tenantId: command.tenantId,
            sku: skuVO,
            name: command.name,
            description: command.description,
            barcode: command.barcode,
            categoryId: command.categoryId,
            productType: command.productType ?? ProductType.STOCKABLE,
            structure,
            costPrice: MoneyVO.create(command.costPrice, 'COP'),
            salePrice: MoneyVO.create(command.salePrice, 'COP'),
            wholesalePrice:
                command.wholesalePrice !== undefined && command.wholesalePrice !== null
                    ? MoneyVO.create(command.wholesalePrice, 'COP')
                    : null,
            taxRate: command.taxRate ?? 0.19,
            minStockAlert: command.minStockAlert ?? 0,
            unitOfMeasureId: uom.getId(),
            costMethod: command.costMethod ?? CostMethod.WEIGHTED_AVERAGE,
        });

        let defaultVariant: ProductVariant | undefined;

        if (structure === ProductStructure.SIMPLE) {
            defaultVariant = ProductVariant.create({
                id: randomUUID(),
                tenantId: command.tenantId,
                productId: product.getId(),
                sku: skuVO,
                name: product.getName(),
                description: product.getDescription(),
                costPrice: product.getCostPrice(),
                salePrice: product.getSalePrice(),
                wholesalePrice: product.getWholesalePrice(),
                taxRate: product.getTaxRate(),
                minStockAlert: product.getMinStockAlert(),
                unitOfMeasureId: product.getUnitOfMeasureId(),
                isDefault: true,
                costMethod: product.getCostMethod(),
            });
        }

        await this.unitOfWork.execute(async (tx) => {
            await tx.productRepository.save(product);

            if (defaultVariant) {
                await tx.productVariantRepository.save(defaultVariant);
            }
        });

        return {
            id: product.getId(),
            sku: product.getSku().getValue(),
            name: product.getName(),
            unitOfMeasureId: product.getUnitOfMeasureId(),
            salePrice: product.getSalePrice().getAmount().toFixed(2),
            costPrice: product.getCostPrice().getAmount().toFixed(4),
            isActive: product.isActive(),
            defaultVariantId: defaultVariant?.getId(),
            createdAt: product.getCreatedAt(),
        };
    }
}
