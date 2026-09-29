import Decimal from 'decimal.js';

import { MoneyVO } from '../../value-objects/money.vo';
import { SkuVO } from '../../value-objects/sku.vo';
import { InvalidProductException } from '../../exceptions/invalid-product.exception';

export enum ProductStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    ARCHIVED = 'ARCHIVED',
}

export enum ProductType {
    SIMPLE = 'SIMPLE',
    WITH_VARIANTS = 'WITH_VARIANTS',
}

export enum CostMethod {
    WEIGHTED_AVERAGE = 'WEIGHTED_AVERAGE',
}

export interface CreateProductProps {
    id: string;
    tenantId: string;
    sku: SkuVO;
    name: string;
    description?: string | null;
    categoryId?: string | null;
    productType?: ProductType;
    costPrice: MoneyVO;
    salePrice: MoneyVO;
    wholesalePrice?: MoneyVO | null;
    taxRate: Decimal.Value;
    minStockAlert: Decimal.Value;
    unitOfMeasureId: string;
    costMethod?: CostMethod;
}

export interface ProductProps {
    id: string;
    tenantId: string;
    sku: SkuVO;
    name: string;
    description: string | null;
    categoryId: string | null;
    productType: ProductType;
    status: ProductStatus;
    costPrice: MoneyVO;
    salePrice: MoneyVO;
    wholesalePrice: MoneyVO | null;
    taxRate: Decimal;
    minStockAlert: Decimal;
    unitOfMeasureId: string;
    costMethod: CostMethod;
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
}

export class Product {
    private constructor(
        private readonly id: string,
        private readonly tenantId: string,
        private sku: SkuVO,
        private name: string,
        private description: string | null,
        private categoryId: string | null,
        private productType: ProductType,
        private status: ProductStatus,
        private costPrice: MoneyVO,
        private salePrice: MoneyVO,
        private wholesalePrice: MoneyVO | null,
        private taxRate: Decimal,
        private minStockAlert: Decimal,
        private unitOfMeasureId: string,
        private costMethod: CostMethod,
        private readonly createdAt: Date,
        private updatedAt: Date,
        private archivedAt: Date | null,
    ) { }

    static create(props: CreateProductProps): Product {
        const name = props.name.trim();

        if (!name) {
            throw new InvalidProductException(
                'El nombre del producto es obligatorio',
            );
        }

        if (name.length > 200) {
            throw new InvalidProductException(
                'El nombre del producto no puede superar los 200 caracteres',
            );
        }

        const taxRate = new Decimal(props.taxRate);

        if (!taxRate.isFinite() || taxRate.isNegative()) {
            throw new InvalidProductException(
                'La tasa de impuesto no es válida',
            );
        }

        if (taxRate.greaterThan(100)) {
            throw new InvalidProductException(
                'La tasa de impuesto no puede superar el 100%',
            );
        }

        const minStockAlert = new Decimal(props.minStockAlert);

        if (!minStockAlert.isFinite() || minStockAlert.isNegative()) {
            throw new InvalidProductException(
                'El stock mínimo no puede ser negativo',
            );
        }

        const now = new Date();

        return new Product(
            props.id,
            props.tenantId,
            props.sku,
            name,
            props.description?.trim() || null,
            props.categoryId ?? null,
            props.productType ?? ProductType.SIMPLE,
            ProductStatus.ACTIVE,
            props.costPrice,
            props.salePrice,
            props.wholesalePrice ?? null,
            taxRate,
            minStockAlert,
            props.unitOfMeasureId,
            props.costMethod ?? CostMethod.WEIGHTED_AVERAGE,
            now,
            now,
            null,
        );
    }

    static rehydrate(props: ProductProps): Product {
        return new Product(
            props.id,
            props.tenantId,
            props.sku,
            props.name,
            props.description,
            props.categoryId,
            props.productType,
            props.status,
            props.costPrice,
            props.salePrice,
            props.wholesalePrice,
            props.taxRate,
            props.minStockAlert,
            props.unitOfMeasureId,
            props.costMethod,
            props.createdAt,
            props.updatedAt,
            props.archivedAt,
        );
    }

    updateCommercialInfo(props: {
        name?: string;
        description?: string | null;
        categoryId?: string | null;
        salePrice?: MoneyVO;
        wholesalePrice?: MoneyVO | null;
        taxRate?: Decimal.Value;
        minStockAlert?: Decimal.Value;
        unitOfMeasureId?: string;
    }): void {
        this.ensureNotArchived();

        if (props.name !== undefined) {
            const name = props.name.trim();

            if (!name) {
                throw new InvalidProductException(
                    'El nombre del producto es obligatorio',
                );
            }

            if (name.length > 200) {
                throw new InvalidProductException(
                    'El nombre del producto no puede superar los 200 caracteres',
                );
            }

            this.name = name;
        }

        if (props.description !== undefined) {
            this.description = props.description?.trim() || null;
        }

        if (props.categoryId !== undefined) {
            this.categoryId = props.categoryId;
        }

        if (props.salePrice !== undefined) {
            this.salePrice = props.salePrice;
        }

        if (props.wholesalePrice !== undefined) {
            this.wholesalePrice = props.wholesalePrice;
        }

        if (props.taxRate !== undefined) {
            const taxRate = new Decimal(props.taxRate);

            if (
                !taxRate.isFinite() ||
                taxRate.isNegative() ||
                taxRate.greaterThan(100)
            ) {
                throw new InvalidProductException(
                    'La tasa de impuesto no es válida',
                );
            }

            this.taxRate = taxRate;
        }

        if (props.minStockAlert !== undefined) {
            const minStockAlert = new Decimal(props.minStockAlert);

            if (!minStockAlert.isFinite() || minStockAlert.isNegative()) {
                throw new InvalidProductException(
                    'El stock mínimo no puede ser negativo',
                );
            }

            this.minStockAlert = minStockAlert;
        }

        if (props.unitOfMeasureId !== undefined) {
            this.unitOfMeasureId = props.unitOfMeasureId;
        }

        this.touch();
    }

    changeSku(sku: SkuVO): void {
        this.ensureNotArchived();

        this.sku = sku;
        this.touch();
    }

    activate(): void {
        if (this.status === ProductStatus.ARCHIVED) {
            throw new InvalidProductException(
                'No se puede activar un producto archivado',
            );
        }

        this.status = ProductStatus.ACTIVE;
        this.touch();
    }

    deactivate(): void {
        if (this.status === ProductStatus.ARCHIVED) {
            throw new InvalidProductException(
                'No se puede desactivar un producto archivado',
            );
        }

        this.status = ProductStatus.INACTIVE;
        this.touch();
    }

    archive(): void {
        this.status = ProductStatus.ARCHIVED;
        this.archivedAt = new Date();
        this.touch();
    }

    private ensureNotArchived(): void {
        if (this.status === ProductStatus.ARCHIVED) {
            throw new InvalidProductException(
                'No se puede modificar un producto archivado',
            );
        }
    }

    private touch(): void {
        this.updatedAt = new Date();
    }

    getId(): string {
        return this.id;
    }

    getTenantId(): string {
        return this.tenantId;
    }

    getSku(): SkuVO {
        return this.sku;
    }

    getName(): string {
        return this.name;
    }

    getDescription(): string | null {
        return this.description;
    }

    getCategoryId(): string | null {
        return this.categoryId;
    }

    getProductType(): ProductType {
        return this.productType;
    }

    getStatus(): ProductStatus {
        return this.status;
    }

    getCostPrice(): MoneyVO {
        return this.costPrice;
    }

    getSalePrice(): MoneyVO {
        return this.salePrice;
    }

    getWholesalePrice(): MoneyVO | null {
        return this.wholesalePrice;
    }

    getTaxRate(): Decimal {
        return this.taxRate;
    }

    getMinStockAlert(): Decimal {
        return this.minStockAlert;
    }

    getUnitOfMeasureId(): string {
        return this.unitOfMeasureId;
    }

    getCostMethod(): CostMethod {
        return this.costMethod;
    }

    getCreatedAt(): Date {
        return this.createdAt;
    }

    getUpdatedAt(): Date {
        return this.updatedAt;
    }

    getArchivedAt(): Date | null {
        return this.archivedAt;
    }
}