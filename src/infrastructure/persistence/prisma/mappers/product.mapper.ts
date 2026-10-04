import { Product as PrismaProduct, Prisma } from '@prisma/client';
import Decimal from 'decimal.js';

import {
    CostMethod,
    Product,
    ProductProps,
    ProductStatus,
    ProductStructure,
    ProductType,
} from '../../../../domain/entities/product/entity';
import { MoneyVO } from '../../../../domain/value-objects/money.vo';
import { SkuVO } from '../../../../domain/value-objects/sku.vo';

export class ProductMapper {
    static toDomain(raw: PrismaProduct): Product {
        const props: ProductProps = {
            id: raw.id,
            tenantId: raw.tenantId,
            sku: SkuVO.create(raw.sku),
            name: raw.name,
            description: raw.description,
            barcode: raw.barcode,
            categoryId: raw.categoryId,
            productType: raw.productType as ProductType,
            structure: ProductStructure.SIMPLE,
            status: raw.status as ProductStatus,
            costPrice: MoneyVO.create(new Decimal(raw.costPrice.toString())),
            salePrice: MoneyVO.create(new Decimal(raw.salePrice.toString())),
            wholesalePrice: raw.wholesalePrice
                ? MoneyVO.create(new Decimal(raw.wholesalePrice.toString()))
                : null,
            taxRate: new Decimal(raw.taxRate.toString()),
            minStockAlert: new Decimal(raw.minStockAlert.toString()),
            unitOfMeasureId: raw.unitOfMeasureId,
            costMethod: raw.costMethod as CostMethod,
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
            archivedAt: raw.archivedAt,
        };

        return Product.rehydrate(props);
    }

    static toPersistence(entity: Product): Prisma.ProductUncheckedCreateInput {
        return {
            id: entity.getId(),
            tenantId: entity.getTenantId(),
            sku: entity.getSku().getValue(),
            name: entity.getName(),
            description: entity.getDescription(),
            barcode: entity.getBarcode(),
            categoryId: entity.getCategoryId(),
            productType: entity.getProductType(),
            status: entity.getStatus(),
            costPrice: new Prisma.Decimal(entity.getCostPrice().getAmount().toString()),
            salePrice: new Prisma.Decimal(entity.getSalePrice().getAmount().toString()),
            wholesalePrice: entity.getWholesalePrice()
                ? new Prisma.Decimal(entity.getWholesalePrice()!.getAmount().toString())
                : null,
            taxRate: new Prisma.Decimal(entity.getTaxRate().toString()),
            minStockAlert: new Prisma.Decimal(entity.getMinStockAlert().toString()),
            unitOfMeasureId: entity.getUnitOfMeasureId(),
            costMethod: entity.getCostMethod(),
            createdAt: entity.getCreatedAt(),
            updatedAt: entity.getUpdatedAt(),
            archivedAt: entity.getArchivedAt(),
        };
    }
}
