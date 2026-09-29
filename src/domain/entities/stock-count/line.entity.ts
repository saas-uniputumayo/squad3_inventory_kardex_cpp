import { InvalidStockCountLineException } from '../../exceptions/invalid-stock-count-line.exception';
import {
    QuantityRules,
    QuantityVO,
} from '../../value-objects/quantity.vo';
import { StockCountLineStatus } from './types';

export interface CreateStockCountLineProps {
    id: string;
    stockCountId: string;
    productId: string;
    variantId?: string;
    unitOfMeasureId: string;
    allowsFraction: boolean;
    decimalPlaces: number;
    systemQuantity: QuantityVO;
}

export interface StockCountLineProps {
    id: string;
    stockCountId: string;
    productId: string;
    variantId?: string;
    unitOfMeasureId: string;
    allowsFraction: boolean;
    decimalPlaces: number;
    status: StockCountLineStatus;
    systemQuantity: QuantityVO;
    countedQuantity?: QuantityVO;
    createdAt: Date;
    countedAt?: Date;
}

export class StockCountLine {
    private constructor(
        private readonly id: string,
        private readonly stockCountId: string,
        private readonly productId: string,
        private readonly variantId:
            | string
            | undefined,
        private readonly unitOfMeasureId: string,
        private readonly allowsFraction: boolean,
        private readonly decimalPlaces: number,
        private readonly systemQuantity: QuantityVO,
        private status: StockCountLineStatus,
        private countedQuantity:
            | QuantityVO
            | undefined,
        private readonly createdAt: Date,
        private countedAt:
            | Date
            | undefined,
    ) { }

    static create(
        props: CreateStockCountLineProps,
    ): StockCountLine {
        StockCountLine.validateIdentity(
            props,
        );

        const quantityRules: QuantityRules = {
            unitOfMeasureId:
                props.unitOfMeasureId,
            allowsFraction:
                props.allowsFraction,
            decimalPlaces:
                props.decimalPlaces,
        };

        const systemQuantity =
            QuantityVO.create(
                props.systemQuantity.getAmount(),
                quantityRules,
            );

        return new StockCountLine(
            props.id,
            props.stockCountId,
            props.productId,
            props.variantId,
            props.unitOfMeasureId,
            props.allowsFraction,
            props.decimalPlaces,
            systemQuantity,
            StockCountLineStatus.PENDING,
            undefined,
            new Date(),
            undefined,
        );
    }

    static rehydrate(
        props: StockCountLineProps,
    ): StockCountLine {
        StockCountLine.validateIdentity(
            props,
        );

        StockCountLine.validateStatus(
            props.status,
        );

        const quantityRules: QuantityRules = {
            unitOfMeasureId:
                props.unitOfMeasureId,
            allowsFraction:
                props.allowsFraction,
            decimalPlaces:
                props.decimalPlaces,
        };

        const systemQuantity =
            QuantityVO.create(
                props.systemQuantity.getAmount(),
                quantityRules,
            );

        const countedQuantity =
            props.countedQuantity
                ? QuantityVO.create(
                    props.countedQuantity.getAmount(),
                    quantityRules,
                )
                : undefined;

        if (
            props.status !==
            StockCountLineStatus.PENDING &&
            !countedQuantity
        ) {
            throw new InvalidStockCountLineException(
                'Una línea contada o ajustada debe tener una cantidad física',
            );
        }

        if (
            props.status ===
            StockCountLineStatus.PENDING &&
            countedQuantity
        ) {
            throw new InvalidStockCountLineException(
                'Una línea pendiente no puede tener cantidad física',
            );
        }

        if (
            props.status !==
            StockCountLineStatus.PENDING &&
            !props.countedAt
        ) {
            throw new InvalidStockCountLineException(
                'Una línea contada debe tener fecha de conteo',
            );
        }

        if (
            Number.isNaN(
                props.createdAt.getTime(),
            )
        ) {
            throw new InvalidStockCountLineException(
                'La fecha de creación de la línea no es válida',
            );
        }

        if (
            props.countedAt &&
            Number.isNaN(
                props.countedAt.getTime(),
            )
        ) {
            throw new InvalidStockCountLineException(
                'La fecha de conteo de la línea no es válida',
            );
        }

        return new StockCountLine(
            props.id,
            props.stockCountId,
            props.productId,
            props.variantId,
            props.unitOfMeasureId,
            props.allowsFraction,
            props.decimalPlaces,
            systemQuantity,
            props.status,
            countedQuantity,
            props.createdAt,
            props.countedAt,
        );
    }

    count(
        countedQuantity: QuantityVO,
    ): void {
        if (
            this.status !==
            StockCountLineStatus.PENDING
        ) {
            throw new InvalidStockCountLineException(
                'La línea ya fue contada y no puede modificarse',
            );
        }

        this.ensureSameUnit(
            countedQuantity,
        );

        this.countedQuantity =
            countedQuantity;

        this.status =
            StockCountLineStatus.COUNTED;

        this.countedAt = new Date();
    }

    markAsAdjusted(): void {
        if (
            this.status !==
            StockCountLineStatus.COUNTED
        ) {
            throw new InvalidStockCountLineException(
                'La línea debe estar contada antes de marcarse como ajustada',
            );
        }

        this.status =
            StockCountLineStatus.ADJUSTED;
    }

    getDifferenceQuantity(): QuantityVO {
        if (!this.countedQuantity) {
            throw new InvalidStockCountLineException(
                'La diferencia no puede calcularse antes de contar la línea',
            );
        }

        const difference =
            this.countedQuantity
                .getAmount()
                .minus(
                    this.systemQuantity.getAmount(),
                );

        /*
         * QuantityVO no permite cantidades negativas,
         * por lo que aquí no podemos representar la
         * diferencia directamente como QuantityVO.
         *
         * La diferencia se expone mediante sus dos
         * componentes en lugar de fabricar una cantidad
         * negativa.
         */
        throw new InvalidStockCountLineException(
            'La diferencia firmada debe calcularse mediante getDifferenceAmount()',
        );
    }

    getDifferenceAmount(): import('decimal.js').default {
        if (!this.countedQuantity) {
            throw new InvalidStockCountLineException(
                'La diferencia no puede calcularse antes de contar la línea',
            );
        }

        return this.countedQuantity
            .getAmount()
            .minus(
                this.systemQuantity.getAmount(),
            );
    }

    hasDifference(): boolean {
        return (
            this.getDifferenceAmount().isZero() ===
            false
        );
    }

    isSurplus(): boolean {
        return (
            this.getDifferenceAmount()
                .greaterThan(0)
        );
    }

    isShortage(): boolean {
        return (
            this.getDifferenceAmount()
                .lessThan(0)
        );
    }

    isCounted(): boolean {
        return (
            this.status !==
            StockCountLineStatus.PENDING
        );
    }

    isAdjusted(): boolean {
        return (
            this.status ===
            StockCountLineStatus.ADJUSTED
        );
    }

    getId(): string {
        return this.id;
    }

    getStockCountId(): string {
        return this.stockCountId;
    }

    getProductId(): string {
        return this.productId;
    }

    getVariantId(): string | undefined {
        return this.variantId;
    }

    getUnitOfMeasureId(): string {
        return this.unitOfMeasureId;
    }

    getAllowsFraction(): boolean {
        return this.allowsFraction;
    }

    getDecimalPlaces(): number {
        return this.decimalPlaces;
    }

    getStatus(): StockCountLineStatus {
        return this.status;
    }

    getSystemQuantity(): QuantityVO {
        return this.systemQuantity;
    }

    getCountedQuantity():
        | QuantityVO
        | undefined {
        return this.countedQuantity;
    }

    getCreatedAt(): Date {
        return this.createdAt;
    }

    getCountedAt(): Date | undefined {
        return this.countedAt;
    }

    private ensureSameUnit(
        quantity: QuantityVO,
    ): void {
        if (
            quantity.getUnitOfMeasureId() !==
            this.unitOfMeasureId
        ) {
            throw new InvalidStockCountLineException(
                'La cantidad utiliza una unidad de medida diferente',
            );
        }

        if (
            quantity.getAllowsFraction() !==
            this.allowsFraction
        ) {
            throw new InvalidStockCountLineException(
                'La configuración de fraccionamiento no coincide',
            );
        }

        if (
            quantity.getDecimalPlaces() !==
            this.decimalPlaces
        ) {
            throw new InvalidStockCountLineException(
                'La precisión decimal no coincide',
            );
        }
    }

    private static validateIdentity(
        props: {
            id: string;
            stockCountId: string;
            productId: string;
            unitOfMeasureId: string;
            allowsFraction: boolean;
            decimalPlaces: number;
        },
    ): void {
        if (!props.id.trim()) {
            throw new InvalidStockCountLineException(
                'El identificador de la línea es obligatorio',
            );
        }

        if (!props.stockCountId.trim()) {
            throw new InvalidStockCountLineException(
                'La línea debe pertenecer a un conteo',
            );
        }

        if (!props.productId.trim()) {
            throw new InvalidStockCountLineException(
                'La línea debe pertenecer a un producto',
            );
        }

        if (!props.unitOfMeasureId.trim()) {
            throw new InvalidStockCountLineException(
                'La línea debe tener una unidad de medida',
            );
        }

        if (
            typeof props.allowsFraction !==
            'boolean'
        ) {
            throw new InvalidStockCountLineException(
                'La configuración de fraccionamiento no es válida',
            );
        }

        if (
            !Number.isInteger(
                props.decimalPlaces,
            ) ||
            props.decimalPlaces < 0
        ) {
            throw new InvalidStockCountLineException(
                'La precisión decimal no es válida',
            );
        }

        if (
            !props.allowsFraction &&
            props.decimalPlaces !== 0
        ) {
            throw new InvalidStockCountLineException(
                'Una unidad que no permite fracciones debe tener cero posiciones decimales',
            );
        }
    }

    private static validateStatus(
        status: StockCountLineStatus,
    ): void {
        if (
            !Object.values(
                StockCountLineStatus,
            ).includes(status)
        ) {
            throw new InvalidStockCountLineException(
                'El estado de la línea no es válido',
            );
        }
    }
}