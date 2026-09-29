import Decimal from 'decimal.js';

import { MoneyVO } from '../../value-objects/money.vo';
import { SkuVO } from '../../value-objects/sku.vo';
import { InvalidProductException } from '../../exceptions/invalid-product.exception';
import {
    CostMethod,
    ProductStatus,
    ProductStructure,
    ProductType,
} from '../../types';

export { CostMethod, ProductStatus, ProductStructure, ProductType };

export interface CreateProductProps {
    id: string;
    tenantId: string;
    sku: SkuVO;
    name: string;
    description?: string | null;
    barcode?: string | null;
    categoryId?: string | null;
    productType?: ProductType;
    structure?: ProductStructure;
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
    barcode: string | null;
    categoryId: string | null;
    productType: ProductType;
    structure: ProductStructure;
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
    public static readonly MAX_NAME_LENGTH = 150; // Coincide con schema.prisma VarChar(150)
    public static readonly MAX_BARCODE_LENGTH = 50;

    private constructor(
        private readonly id: string,
        private readonly tenantId: string,
        private sku: SkuVO,
        private name: string,
        private description: string | null,
        private barcode: string | null,
        private categoryId: string | null,
        private productType: ProductType,
        private structure: ProductStructure,
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
        Product.validateIdentity(props);

        const name = props.name.trim();

        if (!name) {
            throw new InvalidProductException(
                'El nombre del producto es obligatorio',
            );
        }

        if (name.length > Product.MAX_NAME_LENGTH) {
            throw new InvalidProductException(
                `El nombre del producto no puede superar los ${Product.MAX_NAME_LENGTH} caracteres`,
            );
        }

        let barcode: string | null = null;
        if (props.barcode !== undefined && props.barcode !== null) {
            barcode = props.barcode.trim();
            if (barcode.length > Product.MAX_BARCODE_LENGTH) {
                throw new InvalidProductException(
                    `El código de barras no puede superar los ${Product.MAX_BARCODE_LENGTH} caracteres`,
                );
            }
            if (barcode.length === 0) {
                barcode = null;
            }
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
            barcode,
            props.categoryId ?? null,
            props.productType ?? ProductType.STOCKABLE,
            props.structure ?? ProductStructure.SIMPLE,
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
        Product.validateIdentity(props);

        return new Product(
            props.id,
            props.tenantId,
            props.sku,
            props.name,
            props.description,
            props.barcode,
            props.categoryId,
            props.productType,
            props.structure ?? ProductStructure.SIMPLE,
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
        barcode?: string | null;
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

            if (name.length > Product.MAX_NAME_LENGTH) {
                throw new InvalidProductException(
                    `El nombre del producto no puede superar los ${Product.MAX_NAME_LENGTH} caracteres`,
                );
            }

            this.name = name;
        }

        if (props.description !== undefined) {
            this.description = props.description?.trim() || null;
        }

        if (props.barcode !== undefined) {
            if (props.barcode === null) {
                this.barcode = null;
            } else {
                const barcode = props.barcode.trim();
                if (barcode.length > Product.MAX_BARCODE_LENGTH) {
                    throw new InvalidProductException(
                        `El código de barras no puede superar los ${Product.MAX_BARCODE_LENGTH} caracteres`,
                    );
                }
                this.barcode = barcode || null;
            }
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
            if (!props.unitOfMeasureId || !props.unitOfMeasureId.trim()) {
                throw new InvalidProductException(
                    'La unidad de medida no puede ser vacía',
                );
            }
            this.unitOfMeasureId = props.unitOfMeasureId.trim();
        }

        this.touch();
    }

    /**
     * Actualiza el costo de referencia/catálogo del producto.
     *
     * IMPORTANTE: Esta operación únicamente actualiza el costo estándar referencial
     * del catálogo. NO modifica el CPP histórico ni los balances de inventario.
     */
    updateCostPrice(costPrice: MoneyVO): void {
        this.ensureNotArchived();
        if (!costPrice) {
            throw new InvalidProductException('El costo es obligatorio');
        }
        this.costPrice = costPrice;
        this.touch();
    }

    changeSku(sku: SkuVO): void {
        this.ensureNotArchived();
        this.sku = sku;
        this.touch();
    }

    activate(): void {
        this.ensureNotArchived();
        if (this.status === ProductStatus.ACTIVE) {
            return;
        }
        this.status = ProductStatus.ACTIVE;
        this.touch();
    }

    deactivate(): void {
        this.ensureNotArchived();
        if (this.status === ProductStatus.INACTIVE) {
            return;
        }
        this.status = ProductStatus.INACTIVE;
        this.touch();
    }

    archive(): void {
        if (this.status === ProductStatus.ARCHIVED) {
            return;
        }
        this.status = ProductStatus.ARCHIVED;
        this.archivedAt = new Date();
        this.touch();
    }

    isActive(): boolean {
        return this.status === ProductStatus.ACTIVE;
    }

    isInactive(): boolean {
        return this.status === ProductStatus.INACTIVE;
    }

    isArchived(): boolean {
        return this.status === ProductStatus.ARCHIVED;
    }

    isStockable(): boolean {
        return this.productType === ProductType.STOCKABLE;
    }

    hasVariants(): boolean {
        return this.structure === ProductStructure.WITH_VARIANTS;
    }

    private ensureNotArchived(): void {
        if (this.status === ProductStatus.ARCHIVED) {
            throw new InvalidProductException(
                'No se puede modificar un producto archivado',
            );
        }
    }

    private static validateIdentity(props: {
        id: string;
        tenantId: string;
        unitOfMeasureId: string;
    }): void {
        if (typeof props.id !== 'string' || !props.id.trim()) {
            throw new InvalidProductException(
                'El identificador del producto es obligatorio',
            );
        }

        if (typeof props.tenantId !== 'string' || !props.tenantId.trim()) {
            throw new InvalidProductException(
                'El producto debe pertenecer a un tenant',
            );
        }

        if (
            typeof props.unitOfMeasureId !== 'string' ||
            !props.unitOfMeasureId.trim()
        ) {
            throw new InvalidProductException(
                'El producto debe tener una unidad de medida',
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

    getBarcode(): string | null {
        return this.barcode;
    }

    getCategoryId(): string | null {
        return this.categoryId;
    }

    getProductType(): ProductType {
        return this.productType;
    }

    getStructure(): ProductStructure {
        return this.structure;
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