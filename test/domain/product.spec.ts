import { Product } from '../../src/domain/entities/product/entity';
import { ProductVariant } from '../../src/domain/entities/product/variant.entity';
import { InvalidProductVariantException } from '../../src/domain/exceptions/invalid-product-variant.exception';
import { InvalidProductException } from '../../src/domain/exceptions/invalid-product.exception';
import {
    ProductStatus,
    ProductStructure,
    ProductType,
    ProductVariantStatus,
} from '../../src/domain/types';
import { MoneyVO } from '../../src/domain/value-objects/money.vo';
import { SkuVO } from '../../src/domain/value-objects/sku.vo';

describe('Product and ProductVariant Entities', () => {
    describe('Product Entity', () => {
        it('should create valid Product with distinct ProductType and ProductStructure', () => {
            const product = Product.create({
                id: 'prod-001',
                tenantId: 'tenant-123',
                sku: SkuVO.create('SKU-LAPTOP-01'),
                name: 'Laptop Gamer Pro',
                productType: ProductType.STOCKABLE,
                structure: ProductStructure.WITH_VARIANTS,
                unitOfMeasureId: 'uom-unit',
                costPrice: MoneyVO.create(1500, 'COP'),
                salePrice: MoneyVO.create(2200, 'COP'),
                taxRate: 0.19,
                minStockAlert: 2,
            });

            expect(product.getId()).toBe('prod-001');
            expect(product.getProductType()).toBe(ProductType.STOCKABLE);
            expect(product.isStockable()).toBe(true);
            expect(product.getStructure()).toBe(ProductStructure.WITH_VARIANTS);
            expect(product.hasVariants()).toBe(true);
            expect(product.getStatus()).toBe(ProductStatus.ACTIVE);
        });

        it('should support catalog costPrice updates without affecting inventory balance', () => {
            const product = Product.create({
                id: 'prod-002',
                tenantId: 'tenant-123',
                sku: SkuVO.create('SKU-MOUSE-01'),
                name: 'Mouse Optico',
                productType: ProductType.STOCKABLE,
                unitOfMeasureId: 'uom-unit',
                costPrice: MoneyVO.create(25, 'COP'),
                salePrice: MoneyVO.create(40, 'COP'),
                taxRate: 0.19,
                minStockAlert: 5,
            });

            product.updateCostPrice(MoneyVO.create(28, 'COP'));
            expect(product.getCostPrice()?.getAmount().toNumber()).toBe(28);
        });

        it('should reject creation with empty identity or SKU', () => {
            expect(() =>
                Product.create({
                    id: '',
                    tenantId: 'tenant-123',
                    sku: SkuVO.create('SKU-VALID'),
                    name: 'Test',
                    unitOfMeasureId: 'uom-unit',
                    costPrice: MoneyVO.create(10, 'COP'),
                    salePrice: MoneyVO.create(15, 'COP'),
                    taxRate: 0,
                    minStockAlert: 0,
                }),
            ).toThrow(InvalidProductException);
        });
    });

    describe('ProductVariant Entity', () => {
        it('should create valid ProductVariant', () => {
            const variant = ProductVariant.create({
                id: 'var-001',
                tenantId: 'tenant-123',
                productId: 'prod-001',
                sku: SkuVO.create('SKU-LAPTOP-16GB'),
                name: '16GB RAM / 512GB SSD',
                unitOfMeasureId: 'uom-unit',
                costPrice: MoneyVO.create(1600, 'COP'),
                salePrice: MoneyVO.create(2400, 'COP'),
                taxRate: 0.19,
                minStockAlert: 1,
            });

            expect(variant.getId()).toBe('var-001');
            expect(variant.getProductId()).toBe('prod-001');
            expect(variant.getStatus()).toBe(ProductVariantStatus.ACTIVE);
            expect(variant.isActive()).toBe(true);
        });

        it('should reject variant without productId', () => {
            expect(() =>
                ProductVariant.create({
                    id: 'var-002',
                    tenantId: 'tenant-123',
                    productId: '',
                    sku: SkuVO.create('SKU-VAR-02'),
                    name: 'Color Rojo',
                    unitOfMeasureId: 'uom-unit',
                    costPrice: MoneyVO.create(10, 'COP'),
                    salePrice: MoneyVO.create(15, 'COP'),
                    taxRate: 0,
                    minStockAlert: 0,
                }),
            ).toThrow(InvalidProductVariantException);
        });
    });
});
