import { InvalidStockCountException } from '../../exceptions/invalid-stock-count.exception';
import { StockCountLine } from './line.entity';
import { StockCountStatus } from './types';

export interface CreateStockCountProps {
    id: string;
    tenantId: string;
    warehouseId: string;
    notes?: string;
    occurredAt?: Date;
}

export interface StockCountProps {
    id: string;
    tenantId: string;
    warehouseId: string;
    status: StockCountStatus;
    notes?: string;
    occurredAt: Date;
    createdAt: Date;
    startedAt?: Date;
    postedAt?: Date;
    cancelledAt?: Date;
}

export class StockCount {
    private readonly lines: StockCountLine[] = [];

    private constructor(
        private readonly id: string,
        private readonly tenantId: string,
        private readonly warehouseId: string,
        private status: StockCountStatus,
        private readonly notes: string | undefined,
        private readonly occurredAt: Date,
        private readonly createdAt: Date,
        private startedAt: Date | undefined,
        private postedAt: Date | undefined,
        private cancelledAt: Date | undefined,
        lines: StockCountLine[] = [],
    ) {
        this.lines = [...lines];
    }

    static create(
        props: CreateStockCountProps,
    ): StockCount {
        StockCount.validateIdentity(
            props,
        );

        const notes =
            props.notes?.trim() || undefined;

        if (notes && notes.length > 1000) {
            throw new InvalidStockCountException(
                'Las notas del conteo no pueden superar los 1000 caracteres',
            );
        }

        const occurredAt =
            props.occurredAt ?? new Date();

        if (
            Number.isNaN(
                occurredAt.getTime(),
            )
        ) {
            throw new InvalidStockCountException(
                'La fecha del conteo no es válida',
            );
        }

        return new StockCount(
            props.id,
            props.tenantId,
            props.warehouseId,
            StockCountStatus.DRAFT,
            notes,
            occurredAt,
            new Date(),
            undefined,
            undefined,
            undefined,
        );
    }

    static rehydrate(
        props: StockCountProps,
        lines: StockCountLine[] = [],
    ): StockCount {
        StockCount.validateIdentity(
            props,
        );

        StockCount.validateStatus(
            props.status,
        );

        const notes =
            props.notes?.trim() || undefined;

        if (notes && notes.length > 1000) {
            throw new InvalidStockCountException(
                'Las notas del conteo no pueden superar los 1000 caracteres',
            );
        }

        if (
            Number.isNaN(
                props.occurredAt.getTime(),
            )
        ) {
            throw new InvalidStockCountException(
                'La fecha del conteo no es válida',
            );
        }

        if (
            Number.isNaN(
                props.createdAt.getTime(),
            )
        ) {
            throw new InvalidStockCountException(
                'La fecha de creación del conteo no es válida',
            );
        }

        if (
            props.status ===
            StockCountStatus.COUNTING &&
            !props.startedAt
        ) {
            throw new InvalidStockCountException(
                'Un conteo en proceso debe tener fecha de inicio',
            );
        }

        if (
            props.status ===
            StockCountStatus.POSTED &&
            !props.postedAt
        ) {
            throw new InvalidStockCountException(
                'Un conteo publicado debe tener fecha de publicación',
            );
        }

        if (
            props.status ===
            StockCountStatus.CANCELLED &&
            !props.cancelledAt
        ) {
            throw new InvalidStockCountException(
                'Un conteo cancelado debe tener fecha de cancelación',
            );
        }

        if (
            props.status ===
            StockCountStatus.DRAFT &&
            (
                props.startedAt ||
                props.postedAt ||
                props.cancelledAt
            )
        ) {
            throw new InvalidStockCountException(
                'Un conteo en borrador no puede tener fechas de proceso, publicación o cancelación',
            );
        }

        if (
            props.status ===
            StockCountStatus.COUNTING &&
            (
                props.postedAt ||
                props.cancelledAt
            )
        ) {
            throw new InvalidStockCountException(
                'Un conteo en proceso no puede tener fecha de publicación o cancelación',
            );
        }

        if (
            props.status ===
            StockCountStatus.POSTED &&
            props.cancelledAt
        ) {
            throw new InvalidStockCountException(
                'Un conteo publicado no puede estar cancelado',
            );
        }

        if (
            props.status ===
            StockCountStatus.CANCELLED &&
            props.postedAt
        ) {
            throw new InvalidStockCountException(
                'Un conteo cancelado no puede estar publicado',
            );
        }

        return new StockCount(
            props.id,
            props.tenantId,
            props.warehouseId,
            props.status,
            notes,
            props.occurredAt,
            props.createdAt,
            props.startedAt,
            props.postedAt,
            props.cancelledAt,
            lines,
        );
    }

    addLine(
        line: StockCountLine,
    ): void {
        this.ensureEditable();

        if (
            line.getStockCountId() !==
            this.id
        ) {
            throw new InvalidStockCountException(
                'La línea no pertenece a este conteo',
            );
        }

        const duplicatedLine =
            this.lines.some(
                (existingLine) =>
                    existingLine.getProductId() ===
                    line.getProductId() &&
                    existingLine.getVariantId() ===
                    line.getVariantId(),
            );

        if (duplicatedLine) {
            throw new InvalidStockCountException(
                'El producto ya existe en este conteo',
            );
        }

        this.lines.push(line);
    }

    removeLine(
        lineId: string,
    ): void {
        if (
            this.status !==
            StockCountStatus.DRAFT
        ) {
            throw new InvalidStockCountException(
                'Las líneas solo pueden eliminarse mientras el conteo está en borrador',
            );
        }

        const index =
            this.lines.findIndex(
                (line) =>
                    line.getId() === lineId,
            );

        if (index === -1) {
            throw new InvalidStockCountException(
                'La línea no existe en este conteo',
            );
        }

        this.lines.splice(index, 1);
    }

    startCounting(): void {
        if (
            this.status !==
            StockCountStatus.DRAFT
        ) {
            throw new InvalidStockCountException(
                'Solo un conteo en borrador puede iniciar el conteo físico',
            );
        }

        if (!this.lines.length) {
            throw new InvalidStockCountException(
                'El conteo debe tener al menos una línea',
            );
        }

        this.status =
            StockCountStatus.COUNTING;

        this.startedAt = new Date();
    }

    post(): void {
        if (
            this.status !==
            StockCountStatus.COUNTING
        ) {
            throw new InvalidStockCountException(
                'Solo un conteo en proceso puede publicarse',
            );
        }

        const pendingLines =
            this.lines.some(
                (line) =>
                    !line.isCounted(),
            );

        if (pendingLines) {
            throw new InvalidStockCountException(
                'No se puede publicar un conteo con líneas pendientes',
            );
        }

        this.status =
            StockCountStatus.POSTED;

        this.postedAt = new Date();
    }

    cancel(): void {
        if (
            this.status !==
            StockCountStatus.DRAFT &&
            this.status !==
            StockCountStatus.COUNTING
        ) {
            throw new InvalidStockCountException(
                'El conteo no puede cancelarse en su estado actual',
            );
        }

        this.status =
            StockCountStatus.CANCELLED;

        this.cancelledAt = new Date();
    }

    hasDifferences(): boolean {
        return this.lines.some(
            (line) =>
                line.isCounted() &&
                line.hasDifference(),
        );
    }

    getLinesWithDifferences():
        readonly StockCountLine[] {
        return this.lines.filter(
            (line) =>
                line.isCounted() &&
                line.hasDifference(),
        );
    }

    areAllLinesCounted(): boolean {
        return (
            this.lines.length > 0 &&
            this.lines.every(
                (line) =>
                    line.isCounted(),
            )
        );
    }

    isDraft(): boolean {
        return (
            this.status ===
            StockCountStatus.DRAFT
        );
    }

    isCounting(): boolean {
        return (
            this.status ===
            StockCountStatus.COUNTING
        );
    }

    isPosted(): boolean {
        return (
            this.status ===
            StockCountStatus.POSTED
        );
    }

    isCancelled(): boolean {
        return (
            this.status ===
            StockCountStatus.CANCELLED
        );
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

    getOccurredAt(): Date {
        return this.occurredAt;
    }

    getCreatedAt(): Date {
        return this.createdAt;
    }

    getStartedAt(): Date | undefined {
        return this.startedAt;
    }

    getPostedAt(): Date | undefined {
        return this.postedAt;
    }

    getCancelledAt(): Date | undefined {
        return this.cancelledAt;
    }

    getLines(): readonly StockCountLine[] {
        return [...this.lines];
    }

    private ensureEditable(): void {
        if (
            this.status !==
            StockCountStatus.DRAFT &&
            this.status !==
            StockCountStatus.COUNTING
        ) {
            throw new InvalidStockCountException(
                'El conteo ya no puede modificarse en su estado actual',
            );
        }
    }

    private static validateIdentity(
        props: {
            id: string;
            tenantId: string;
            warehouseId: string;
        },
    ): void {
        if (!props.id.trim()) {
            throw new InvalidStockCountException(
                'El identificador del conteo es obligatorio',
            );
        }

        if (!props.tenantId.trim()) {
            throw new InvalidStockCountException(
                'El conteo debe pertenecer a un tenant',
            );
        }

        if (!props.warehouseId.trim()) {
            throw new InvalidStockCountException(
                'La bodega del conteo es obligatoria',
            );
        }
    }

    private static validateStatus(
        status: StockCountStatus,
    ): void {
        if (
            !Object.values(
                StockCountStatus,
            ).includes(status)
        ) {
            throw new InvalidStockCountException(
                'El estado del conteo no es válido',
            );
        }
    }
}