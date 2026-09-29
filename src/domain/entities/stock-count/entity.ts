import { InvalidStockCountException } from '../../exceptions/invalid-stock-count.exception';
import { StockCountStatus } from '../../types';
import { StockCountLine } from './line.entity';

export interface CreateStockCountProps {
    id: string;
    tenantId: string;
    warehouseId: string;
    notes?: string;
}

export interface StockCountProps {
    id: string;
    tenantId: string;
    warehouseId: string;
    status: StockCountStatus;
    notes?: string;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    cancelledAt?: Date;
}

export class StockCount {
    private readonly lines: StockCountLine[] = [];

    private constructor(
        private readonly id: string,
        private readonly tenantId: string,
        private readonly warehouseId: string,
        private status: StockCountStatus,
        private notes: string | undefined,
        private readonly createdAt: Date,
        private startedAt: Date | undefined,
        private completedAt: Date | undefined,
        private cancelledAt: Date | undefined,
        lines: StockCountLine[] = [],
    ) {
        this.lines = [...lines];
    }

    static create(props: CreateStockCountProps): StockCount {
        StockCount.validateIdentity(props);

        const notes = props.notes?.trim() || undefined;

        if (notes && notes.length > 1000) {
            throw new InvalidStockCountException(
                'Las notas del conteo no pueden superar los 1000 caracteres',
            );
        }

        return new StockCount(
            props.id,
            props.tenantId,
            props.warehouseId,
            StockCountStatus.DRAFT,
            notes,
            new Date(),
            undefined,
            undefined,
            undefined,
            [],
        );
    }

    static rehydrate(
        props: StockCountProps,
        lines: StockCountLine[] = [],
    ): StockCount {
        StockCount.validateIdentity(props);
        StockCount.validateStatus(props.status);

        const notes = props.notes?.trim() || undefined;

        if (notes && notes.length > 1000) {
            throw new InvalidStockCountException(
                'Las notas del conteo no pueden superar los 1000 caracteres',
            );
        }

        if (Number.isNaN(props.createdAt.getTime())) {
            throw new InvalidStockCountException(
                'La fecha de creación del conteo no es válida',
            );
        }

        if (
            props.status === StockCountStatus.IN_PROGRESS &&
            !props.startedAt
        ) {
            throw new InvalidStockCountException(
                'Un conteo en proceso (IN_PROGRESS) debe tener fecha de inicio (startedAt)',
            );
        }

        if (
            props.status === StockCountStatus.COMPLETED &&
            !props.completedAt
        ) {
            throw new InvalidStockCountException(
                'Un conteo completado (COMPLETED) debe tener fecha de finalización (completedAt)',
            );
        }

        if (
            props.status === StockCountStatus.CANCELLED &&
            !props.cancelledAt
        ) {
            throw new InvalidStockCountException(
                'Un conteo cancelado (CANCELLED) debe tener fecha de cancelación (cancelledAt)',
            );
        }

        if (
            props.status === StockCountStatus.DRAFT &&
            (props.startedAt || props.completedAt || props.cancelledAt)
        ) {
            throw new InvalidStockCountException(
                'Un conteo en borrador no puede tener fechas de inicio, finalización o cancelación',
            );
        }

        if (
            props.status === StockCountStatus.COMPLETED &&
            props.cancelledAt
        ) {
            throw new InvalidStockCountException(
                'Un conteo completado no puede estar cancelado',
            );
        }

        if (
            props.status === StockCountStatus.CANCELLED &&
            props.completedAt
        ) {
            throw new InvalidStockCountException(
                'Un conteo cancelado no puede estar completado',
            );
        }

        return new StockCount(
            props.id,
            props.tenantId,
            props.warehouseId,
            props.status,
            notes,
            props.createdAt,
            props.startedAt,
            props.completedAt,
            props.cancelledAt,
            lines,
        );
    }

    addLine(line: StockCountLine): void {
        this.ensureDraft();

        if (line.getStockCountId() !== this.id) {
            throw new InvalidStockCountException(
                'La línea no pertenece a este conteo',
            );
        }

        const duplicatedLine = this.lines.some(
            (existingLine) =>
                existingLine.getProductId() === line.getProductId() &&
                existingLine.getVariantId() === line.getVariantId(),
        );

        if (duplicatedLine) {
            throw new InvalidStockCountException(
                'La variante de producto ya existe en este conteo físico',
            );
        }

        this.lines.push(line);
    }

    removeLine(lineId: string): void {
        this.ensureDraft();

        const index = this.lines.findIndex((line) => line.getId() === lineId);

        if (index === -1) {
            throw new InvalidStockCountException(
                'La línea no existe en este conteo',
            );
        }

        this.lines.splice(index, 1);
    }

    startCounting(): void {
        if (this.status !== StockCountStatus.DRAFT) {
            throw new InvalidStockCountException(
                'Solo un conteo en estado DRAFT puede iniciar el conteo físico (pasar a IN_PROGRESS)',
            );
        }

        if (!this.lines.length) {
            throw new InvalidStockCountException(
                'El conteo debe tener al menos una línea para iniciar el conteo',
            );
        }

        this.status = StockCountStatus.IN_PROGRESS;
        this.startedAt = new Date();
    }

    complete(): void {
        if (this.status !== StockCountStatus.IN_PROGRESS) {
            throw new InvalidStockCountException(
                'Solo un conteo en proceso (IN_PROGRESS) puede completarse (pasar a COMPLETED)',
            );
        }

        const hasPendingLines = this.lines.some((line) => line.isPending());

        if (hasPendingLines) {
            throw new InvalidStockCountException(
                'No se puede completar un conteo con líneas pendientes de contar',
            );
        }

        this.status = StockCountStatus.COMPLETED;
        this.completedAt = new Date();
    }

    cancel(): void {
        if (
            this.status !== StockCountStatus.DRAFT &&
            this.status !== StockCountStatus.IN_PROGRESS
        ) {
            throw new InvalidStockCountException(
                'El conteo no puede cancelarse en su estado actual',
            );
        }

        this.status = StockCountStatus.CANCELLED;
        this.cancelledAt = new Date();

        for (const line of this.lines) {
            if (!line.isApplied()) {
                line.cancel();
            }
        }
    }

    hasDifferences(): boolean {
        return this.lines.some(
            (line) => line.isCounted() && line.hasDifference(),
        );
    }

    getLinesWithDifferences(): readonly StockCountLine[] {
        return this.lines.filter(
            (line) => line.isCounted() && line.hasDifference(),
        );
    }

    areAllLinesCounted(): boolean {
        return (
            this.lines.length > 0 &&
            this.lines.every((line) => line.isCounted() || line.isApplied())
        );
    }

    isDraft(): boolean {
        return this.status === StockCountStatus.DRAFT;
    }

    isInProgress(): boolean {
        return this.status === StockCountStatus.IN_PROGRESS;
    }

    isCompleted(): boolean {
        return this.status === StockCountStatus.COMPLETED;
    }

    isCancelled(): boolean {
        return this.status === StockCountStatus.CANCELLED;
    }

    getId(): string {
        return this.id;
    }

    getTenantId(): string {
        return this.tenantId;
    }

    getWarehouseId(): string {
        return this.warehouseId;
    }

    getStatus(): StockCountStatus {
        return this.status;
    }

    getNotes(): string | undefined {
        return this.notes;
    }

    getCreatedAt(): Date {
        return this.createdAt;
    }

    getStartedAt(): Date | undefined {
        return this.startedAt;
    }

    getCompletedAt(): Date | undefined {
        return this.completedAt;
    }

    getCancelledAt(): Date | undefined {
        return this.cancelledAt;
    }

    getLines(): readonly StockCountLine[] {
        return [...this.lines];
    }

    private ensureDraft(): void {
        if (this.status !== StockCountStatus.DRAFT) {
            throw new InvalidStockCountException(
                'Las líneas solo pueden modificarse cuando el conteo está en borrador (DRAFT)',
            );
        }
    }

    private static validateIdentity(props: {
        id: string;
        tenantId: string;
        warehouseId: string;
    }): void {
        if (!props.id || !props.id.trim()) {
            throw new InvalidStockCountException(
                'El identificador del conteo es obligatorio',
            );
        }

        if (!props.tenantId || !props.tenantId.trim()) {
            throw new InvalidStockCountException(
                'El conteo debe pertenecer a un tenant',
            );
        }

        if (!props.warehouseId || !props.warehouseId.trim()) {
            throw new InvalidStockCountException(
                'La bodega del conteo es obligatoria',
            );
        }
    }

    private static validateStatus(status: StockCountStatus): void {
        if (!Object.values(StockCountStatus).includes(status)) {
            throw new InvalidStockCountException(
                `El estado del conteo no es válido: ${status}`,
            );
        }
    }
}