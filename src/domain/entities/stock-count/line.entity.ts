import Decimal from 'decimal.js';
import { InvalidStockCountLineException } from '../../exceptions/invalid-stock-count-line.exception';
import {
    MovementType,
    StockCountLineStatus,
} from '../../types';
import {
    QuantityRules,
    QuantityVO,
} from '../../value-objects/quantity.vo';

export interface CreateStockCountLineProps {
    id: string;
    stockCountId: string;
    productId: string;
    variantId: string;
    unitOfMeasureId: string;
    allowsFraction: boolean;
    decimalPlaces: number;
    systemQuantity: QuantityVO;
    notes?: string;
}

export interface StockCountLineProps {
    id: string;
    stockCountId: string;
    productId: string;
    variantId: string;
    unitOfMeasureId: string;
    allowsFraction: boolean;
    decimalPlaces: number;
    status: StockCountLineStatus;
    systemQuantity: QuantityVO;
    countedQuantity?: QuantityVO;
    notes?: string;
    createdAt: Date;
    countedAt?: Date;
}

export class StockCountLine {
    private constructor(
        private readonly id: string,
        private readonly stockCountId: string,
        private readonly productId: string,
        private readonly variantId: string,
        private readonly unitOfMeasureId: string,
        private readonly allowsFraction: boolean,
        private readonly decimalPlaces: number,
        private readonly systemQuantity: QuantityVO,
        private status: StockCountLineStatus,
        private countedQuantity: QuantityVO | undefined,
        private notes: string | undefined,
        private readonly createdAt: Date,
        private countedAt: Date | undefined,
    ) {}

    static create(props: CreateStockCountLineProps): StockCountLine {
        StockCountLine.validateIdentity(props);

        const quantityRules: QuantityRules = {
            unitOfMeasureId: props.unitOfMeasureId,
            allowsFraction: props.allowsFraction,
            decimalPlaces: props.decimalPlaces,
        };

        const systemQuantity = QuantityVO.create(
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
            props.notes?.trim() || undefined,
            new Date(),
            undefined,
        );
    }

    static rehydrate(props: StockCountLineProps): StockCountLine {
        StockCountLine.validateIdentity(props);
        StockCountLine.validateStatus(props.status);

        const quantityRules: QuantityRules = {
            unitOfMeasureId: props.unitOfMeasureId,
            allowsFraction: props.allowsFraction,
            decimalPlaces: props.decimalPlaces,
        };

        const systemQuantity = QuantityVO.create(
            props.systemQuantity.getAmount(),
            quantityRules,
        );

        const countedQuantity = props.countedQuantity
            ? QuantityVO.create(
                  props.countedQuantity.getAmount(),
                  quantityRules,
              )
            : undefined;

        if (
            (props.status === StockCountLineStatus.COUNTED ||
                props.status === StockCountLineStatus.APPLIED) &&
            !countedQuantity
        ) {
            throw new InvalidStockCountLineException(
                'Una línea contada o aplicada debe tener una cantidad física',
            );
        }

        if (
            props.status === StockCountLineStatus.PENDING &&
            countedQuantity
        ) {
            throw new InvalidStockCountLineException(
                'Una línea pendiente no puede tener cantidad física registrada',
            );
        }

        if (
            (props.status === StockCountLineStatus.COUNTED ||
                props.status === StockCountLineStatus.APPLIED) &&
            !props.countedAt
        ) {
            throw new InvalidStockCountLineException(
                'Una línea contada debe tener fecha de conteo',
            );
        }

        if (Number.isNaN(props.createdAt.getTime())) {
            throw new InvalidStockCountLineException(
                'La fecha de creación de la línea no es válida',
            );
        }

        if (props.countedAt && Number.isNaN(props.countedAt.getTime())) {
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
            props.notes?.trim() || undefined,
            props.createdAt,
            props.countedAt,
        );
    }

    count(countedQuantity: QuantityVO, notes?: string): void {
        if (this.status !== StockCountLineStatus.PENDING) {
            throw new InvalidStockCountLineException(
                'La línea solo puede contarse cuando está en estado PENDING',
            );
        }

        this.ensureSameUnit(countedQuantity);

        this.countedQuantity = countedQuantity;
        this.status = StockCountLineStatus.COUNTED;
        this.countedAt = new Date();
        if (notes !== undefined) {
            this.notes = notes.trim() || undefined;
        }
    }

    markAsApplied(): void {
        if (this.status !== StockCountLineStatus.COUNTED) {
            throw new InvalidStockCountLineException(
                'La línea debe estar contada (COUNTED) antes de marcarse como aplicada (APPLIED)',
            );
        }

        this.status = StockCountLineStatus.APPLIED;
    }

    cancel(): void {
        if (this.status === StockCountLineStatus.APPLIED) {
            throw new InvalidStockCountLineException(
                'Una línea ya aplicada no puede cancelarse',
            );
        }

        this.status = StockCountLineStatus.CANCELLED;
    }

    /**
     * Diferencia física firmada: física - sistema.
     * Retorna Decimal directamente para soportar diferencias negativas sin forzar QuantityVO no firmado.
     */
    getDifferenceAmount(): Decimal {
        if (!this.countedQuantity) {
            throw new InvalidStockCountLineException(
                'La diferencia no puede calcularse antes de registrar el conteo físico',
            );
        }

        return this.countedQuantity
            .getAmount()
            .minus(this.systemQuantity.getAmount());
    }

    /**
     * Magnitud absoluta de la diferencia física.
     */
    getAbsDifferenceAmount(): Decimal {
        return this.getDifferenceAmount().abs();
    }

    /**
     * Indica si existe alguna discrepancia entre conteo físico y sistema.
     */
    hasDifference(): boolean {
        return !this.getDifferenceAmount().isZero();
    }

    /**
     * Indica si hay sobrante físico (físico > sistema).
     * Requiere movimiento de entrada (ADJUSTMENT_IN).
     */
    isSurplus(): boolean {
        return this.getDifferenceAmount().greaterThan(0);
    }

    /**
     * Indica si hay faltante físico (físico < sistema).
     * Requiere movimiento de salida (ADJUSTMENT_OUT).
     */
    isShortage(): boolean {
        return this.getDifferenceAmount().lessThan(0);
    }

    /**
     * Determina el tipo de movimiento de inventario requerido por la discrepancia.
     * Retorna null si la diferencia es cero.
     */
    getRequiredMovementType(): MovementType | null {
        if (this.isSurplus()) {
            return MovementType.ADJUSTMENT_IN;
        }
        if (this.isShortage()) {
            return MovementType.ADJUSTMENT_OUT;
        }
        return null;
    }

    isPending(): boolean {
        return this.status === StockCountLineStatus.PENDING;
    }

    isCounted(): boolean {
        return this.status === StockCountLineStatus.COUNTED;
    }

    isApplied(): boolean {
        return this.status === StockCountLineStatus.APPLIED;
    }

    isCancelled(): boolean {
        return this.status === StockCountLineStatus.CANCELLED;
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

    getVariantId(): string {
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

    getCountedQuantity(): QuantityVO | undefined {
        return this.countedQuantity;
    }

    getNotes(): string | undefined {
        return this.notes;
    }

    getCreatedAt(): Date {
        return this.createdAt;
    }

    getCountedAt(): Date | undefined {
        return this.countedAt;
    }

    private ensureSameUnit(quantity: QuantityVO): void {
        if (quantity.getUnitOfMeasureId() !== this.unitOfMeasureId) {
            throw new InvalidStockCountLineException(
                'La cantidad utiliza una unidad de medida diferente a la línea de conteo',
            );
        }

        if (quantity.getAllowsFraction() !== this.allowsFraction) {
            throw new InvalidStockCountLineException(
                'La configuración de fraccionamiento no coincide',
            );
        }

        if (quantity.getDecimalPlaces() !== this.decimalPlaces) {
            throw new InvalidStockCountLineException(
                'La precisión decimal no coincide',
            );
        }
    }

    private static validateIdentity(props: {
        id: string;
        stockCountId: string;
        productId: string;
        variantId: string;
        unitOfMeasureId: string;
        allowsFraction: boolean;
        decimalPlaces: number;
    }): void {
        if (!props.id || !props.id.trim()) {
            throw new InvalidStockCountLineException(
                'El identificador de la línea es obligatorio',
            );
        }

        if (!props.stockCountId || !props.stockCountId.trim()) {
            throw new InvalidStockCountLineException(
                'La línea debe pertenecer a un conteo',
            );
        }

        if (!props.productId || !props.productId.trim()) {
            throw new InvalidStockCountLineException(
                'La línea debe pertenecer a un producto',
            );
        }

        if (!props.variantId || !props.variantId.trim()) {
            throw new InvalidStockCountLineException(
                'La línea debe pertenecer a una variante específica',
            );
        }

        if (!props.unitOfMeasureId || !props.unitOfMeasureId.trim()) {
            throw new InvalidStockCountLineException(
                'La línea debe tener una unidad de medida',
            );
        }

        if (typeof props.allowsFraction !== 'boolean') {
            throw new InvalidStockCountLineException(
                'La configuración de fraccionamiento no es válida',
            );
        }

        if (
            !Number.isInteger(props.decimalPlaces) ||
            props.decimalPlaces < 0
        ) {
            throw new InvalidStockCountLineException(
                'La precisión decimal no es válida',
            );
        }

        if (!props.allowsFraction && props.decimalPlaces !== 0) {
            throw new InvalidStockCountLineException(
                'Una unidad que no permite fracciones debe tener cero posiciones decimales',
            );
        }
    }

    private static validateStatus(status: StockCountLineStatus): void {
        if (!Object.values(StockCountLineStatus).includes(status)) {
            throw new InvalidStockCountLineException(
                `El estado de la línea no es válido: ${status}`,
            );
        }
    }
}