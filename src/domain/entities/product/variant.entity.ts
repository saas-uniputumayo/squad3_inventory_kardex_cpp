import Decimal from 'decimal.js';

import { InvalidProductVariantException } from '../../exceptions/invalid-product-variant.exception';
import { MoneyVO } from '../../value-objects/money.vo';
import { SkuVO } from '../../value-objects/sku.vo';
import { CostMethod, ProductVariantStatus } from '../../types';

export { ProductVariantStatus };

export interface CreateProductVariantProps {
    id: string;
    tenantId: string;
    productId: string;
    sku: SkuVO;
    name: string;
    description?: string | null;
    costPrice: MoneyVO;
    salePrice: MoneyVO;
    wholesalePrice?: MoneyVO | null;
    taxRate: Decimal.Value;
    minStockAlert: Decimal.Value;
    unitOfMeasureId: string;
    isDefault?: boolean;
    costMethod?: CostMethod;
}

export interface ProductVariantProps {
    id: string;
    tenantId: string;
    productId: string;
    sku: SkuVO;
    name: string;
    description: string | null;
    status: ProductVariantStatus;
    costPrice: MoneyVO;
    salePrice: MoneyVO;
    wholesalePrice: MoneyVO | null;
    taxRate: Decimal;
    minStockAlert: Decimal;
    unitOfMeasureId: string;
    isDefault: boolean;
    costMethod: CostMethod;
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
}

export class ProductVariant {
    public static readonly MAX_NAME_LENGTH = 150; // Coincide con schema.prisma VarChar(150)

    private constructor(
        private readonly id: string,
        private readonly tenantId: string,
        private readonly productId: string,
        private sku: SkuVO,
        private name: string,
        private description: string | null,
        private status: ProductVariantStatus,
        private costPrice: MoneyVO,
        private salePrice: MoneyVO,
        private wholesalePrice: MoneyVO | null,
        private taxRate: Decimal,
        private minStockAlert: Decimal,
        private unitOfMeasureId: string,
        private isDefault: boolean,
        private costMethod: CostMethod,
        private readonly createdAt: Date,
        private updatedAt: Date,
        private archivedAt: Date | null,
    ) { }

    static create(props: CreateProductVariantProps): ProductVariant {
        ProductVariant.validateIdentity(props);

        const name = props.name.trim();

        if (!name) {
            throw new InvalidProductVariantException(
                'El nombre de la variante es obligatorio',
            );
        }

        if (name.length > ProductVariant.MAX_NAME_LENGTH) {
            throw new InvalidProductVariantException(
                `El nombre de la variante no puede superar los ${ProductVariant.MAX_NAME_LENGTH} caracteres`,
            );
        }

        const taxRate = new Decimal(props.taxRate);

        if (
            !taxRate.isFinite() ||
            taxRate.isNegative() ||
            taxRate.greaterThan(100)
        ) {
            throw new InvalidProductVariantException(
                'La tasa de impuesto no es válida',
            );
        }

        const minStockAlert = new Decimal(props.minStockAlert);

        if (!minStockAlert.isFinite() || minStockAlert.isNegative()) {
            throw new InvalidProductVariantException(
                'El stock mínimo no puede ser negativo',
            );
        }

        const now = new Date();

        return new ProductVariant(
            props.id,
            props.tenantId,
            props.productId,
            props.sku,
            name,
            props.description?.trim() || null,
            ProductVariantStatus.ACTIVE,
            props.costPrice,
            props.salePrice,
            props.wholesalePrice ?? null,
            taxRate,
            minStockAlert,
            props.unitOfMeasureId,
            props.isDefault ?? false,
            props.costMethod ?? CostMethod.WEIGHTED_AVERAGE,
            now,
            now,
            null,
        );
    }

    static rehydrate(props: ProductVariantProps): ProductVariant {
        ProductVariant.validateIdentity(props);

        return new ProductVariant(
            props.id,
            props.tenantId,
            props.productId,
            props.sku,
            props.name,
            props.description,
            props.status,
            props.costPrice,
            props.salePrice,
            props.wholesalePrice,
            props.taxRate,
            props.minStockAlert,
            props.unitOfMeasureId,
            props.isDefault,
            props.costMethod,
            props.createdAt,
            props.updatedAt,
            props.archivedAt,
        );
    }

    updateCommercialInfo(props: {
        name?: string;
        description?: string | null;
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
                throw new InvalidProductVariantException(
                    'El nombre de la variante es obligatorio',
                );
            }

            if (name.length > ProductVariant.MAX_NAME_LENGTH) {
                throw new InvalidProductVariantException(
                    `El nombre de la variante no puede superar los ${ProductVariant.MAX_NAME_LENGTH} caracteres`,
                );
            }

            this.name = name;
        }

        if (props.description !== undefined) {
            this.description = props.description?.trim() || null;
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
                throw new InvalidProductVariantException(
                    'La tasa de impuesto no es válida',
                );
            }

            this.taxRate = taxRate;
        }

        if (props.minStockAlert !== undefined) {
            const minStockAlert = new Decimal(props.minStockAlert);

            if (!minStockAlert.isFinite() || minStockAlert.isNegative()) {
                throw new InvalidProductVariantException(
                    'El stock mínimo no puede ser negativo',
                );
            }

            this.minStockAlert = minStockAlert;
        }

        if (props.unitOfMeasureId !== undefined) {
            if (!props.unitOfMeasureId || !props.unitOfMeasureId.trim()) {
                throw new InvalidProductVariantException(
                    'La unidad de medida no puede ser vacía',
                );
            }
            this.unitOfMeasureId = props.unitOfMeasureId.trim();
        }

        this.touch();
    }

    /**
     * Actualiza el costo referencial de la variante.
     */
    updateCostPrice(costPrice: MoneyVO): void {
        this.ensureNotArchived();
        if (!costPrice) {
            throw new InvalidProductVariantException('El costo es obligatorio');
        }
        this.costPrice = costPrice;
        this.touch();
    }

    changeSku(sku: SkuVO): void {
        this.ensureNotArchived();
        this.sku = sku;
        this.touch();
    }

    markAsDefault(): void {
        this.ensureNotArchived();
        this.isDefault = true;
        this.touch();
    }

    unmarkAsDefault(): void {
        this.ensureNotArchived();
        this.isDefault = false;
        this.touch();
    }

    activate(): void {
        this.ensureNotArchived();
        if (this.status === ProductVariantStatus.ACTIVE) {
            return;
        }
        this.status = ProductVariantStatus.ACTIVE;
        this.touch();
    }

    deactivate(): void {
        this.ensureNotArchived();
        if (this.status === ProductVariantStatus.INACTIVE) {
            return;
        }
        this.status = ProductVariantStatus.INACTIVE;
        this.touch();
    }

    archive(): void {
        if (this.status === ProductVariantStatus.ARCHIVED) {
            return;
        }
        this.status = ProductVariantStatus.ARCHIVED;
        this.archivedAt = new Date();
        this.touch();
    }

    isActive(): boolean {
        return this.status === ProductVariantStatus.ACTIVE;
    }

    isInactive(): boolean {
        return this.status === ProductVariantStatus.INACTIVE;
    }

    isArchived(): boolean {
        return this.status === ProductVariantStatus.ARCHIVED;
    }

    private ensureNotArchived(): void {
        if (this.isArchived()) {
            throw new InvalidProductVariantException(
                'No se puede modificar una variante archivada',
            );
        }
    }

    private static validateIdentity(props: {
        id: string;
        tenantId: string;
        productId: string;
        unitOfMeasureId: string;
    }): void {
        if (typeof props.id !== 'string' || !props.id.trim()) {
            throw new InvalidProductVariantException(
                'El identificador de la variante es obligatorio',
            );
        }

        if (typeof props.tenantId !== 'string' || !props.tenantId.trim()) {
            throw new InvalidProductVariantException(
                'La variante debe pertenecer a un tenant',
            );
        }

        if (typeof props.productId !== 'string' || !props.productId.trim()) {
            throw new InvalidProductVariantException(
                'La variante debe pertenecer a un producto',
            );
        }

        if (
            typeof props.unitOfMeasureId !== 'string' ||
            !props.unitOfMeasureId.trim()
        ) {
            throw new InvalidProductVariantException(
                'La variante debe tener una unidad de medida',
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

    getProductId(): string {
        return this.productId;
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

    getStatus(): ProductVariantStatus {
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

    getIsDefault(): boolean {
        return this.isDefault;
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