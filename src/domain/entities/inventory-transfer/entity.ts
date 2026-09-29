import { InvalidInventoryTransferException } from '../../exceptions/invalid-inventory-transfer.exception';
import { TransferReferenceVO } from '../../value-objects/transfer-reference.vo';
import { InventoryTransferLine } from './line.entity';
import { TransferStatus } from '../../types';

export { TransferStatus };

export interface CreateInventoryTransferProps {
    id: string;
    tenantId: string;
    sourceWarehouseId: string;
    destinationWarehouseId: string;
    reference: TransferReferenceVO;
    notes?: string;
    occurredAt?: Date;
    lines?: InventoryTransferLine[];
}

export interface InventoryTransferProps {
    id: string;
    tenantId: string;
    sourceWarehouseId: string;
    destinationWarehouseId: string;
    status: TransferStatus;
    reference: TransferReferenceVO;
    notes?: string;
    reason?: string | null;
    createdById?: string | null;
    completedById?: string | null;
    outboundMovementId?: string | null;
    inboundMovementId?: string | null;
    occurredAt: Date;
    createdAt: Date;
    completedAt?: Date | null;
    cancelledAt?: Date | null;
}

export class InventoryTransfer {
    private readonly lines: InventoryTransferLine[] = [];

    private constructor(
        private readonly id: string,
        private readonly tenantId: string,
        private readonly sourceWarehouseId: string,
        private readonly destinationWarehouseId: string,
        private status: TransferStatus,
        private readonly reference: TransferReferenceVO,
        private readonly notes: string | undefined,
        private readonly reason: string | null,
        private readonly createdById: string | null,
        private completedById: string | null,
        private outboundMovementId: string | null,
        private inboundMovementId: string | null,
        private readonly occurredAt: Date,
        private readonly createdAt: Date,
        private completedAt: Date | null,
        private cancelledAt: Date | null,
        lines: InventoryTransferLine[] = [],
    ) {
        this.lines = [...lines];
    }

    static create(
        props: CreateInventoryTransferProps,
    ): InventoryTransfer {
        InventoryTransfer.validateIdentity(props);

        const notes = props.notes?.trim() || undefined;

        if (notes && notes.length > 1000) {
            throw new InvalidInventoryTransferException(
                'Las notas de la transferencia no pueden superar los 1000 caracteres',
            );
        }

        const occurredAt = props.occurredAt ?? new Date();

        if (Number.isNaN(occurredAt.getTime())) {
            throw new InvalidInventoryTransferException(
                'La fecha de la transferencia no es válida',
            );
        }

        const transfer = new InventoryTransfer(
            props.id,
            props.tenantId,
            props.sourceWarehouseId,
            props.destinationWarehouseId,
            TransferStatus.DRAFT,
            props.reference,
            notes,
            null,
            null,
            null,
            null,
            null,
            occurredAt,
            new Date(),
            null,
            null,
            props.lines ?? [],
        );

        return transfer;
    }

    static rehydrate(
        props: InventoryTransferProps,
        lines: InventoryTransferLine[] = [],
    ): InventoryTransfer {
        InventoryTransfer.validateIdentity(props);
        InventoryTransfer.validateStatus(props.status);

        const notes = props.notes?.trim() || undefined;

        if (notes && notes.length > 1000) {
            throw new InvalidInventoryTransferException(
                'Las notas de la transferencia no pueden superar los 1000 caracteres',
            );
        }

        if (Number.isNaN(props.occurredAt.getTime())) {
            throw new InvalidInventoryTransferException(
                'La fecha de la transferencia no es válida',
            );
        }

        if (Number.isNaN(props.createdAt.getTime())) {
            throw new InvalidInventoryTransferException(
                'La fecha de creación de la transferencia no es válida',
            );
        }

        if (props.status === TransferStatus.COMPLETED && !props.completedAt) {
            throw new InvalidInventoryTransferException(
                'Una transferencia completada debe tener fecha de finalización',
            );
        }

        if (props.status === TransferStatus.CANCELLED && !props.cancelledAt) {
            throw new InvalidInventoryTransferException(
                'Una transferencia cancelada debe tener fecha de cancelación',
            );
        }

        if (
            props.status === TransferStatus.DRAFT &&
            (props.completedAt || props.cancelledAt)
        ) {
            throw new InvalidInventoryTransferException(
                'Una transferencia en borrador no puede tener fecha de finalización o cancelación',
            );
        }

        if (
            props.status === TransferStatus.IN_TRANSIT &&
            (props.completedAt || props.cancelledAt)
        ) {
            throw new InvalidInventoryTransferException(
                'Una transferencia en tránsito no puede tener fecha de finalización o cancelación',
            );
        }

        if (
            props.status === TransferStatus.COMPLETED &&
            props.cancelledAt
        ) {
            throw new InvalidInventoryTransferException(
                'Una transferencia completada no puede estar cancelada',
            );
        }

        if (
            props.status === TransferStatus.CANCELLED &&
            props.completedAt
        ) {
            throw new InvalidInventoryTransferException(
                'Una transferencia cancelada no puede estar completada',
            );
        }

        return new InventoryTransfer(
            props.id,
            props.tenantId,
            props.sourceWarehouseId,
            props.destinationWarehouseId,
            props.status,
            props.reference,
            notes,
            props.reason ?? null,
            props.createdById ?? null,
            props.completedById ?? null,
            props.outboundMovementId ?? null,
            props.inboundMovementId ?? null,
            props.occurredAt,
            props.createdAt,
            props.completedAt ?? null,
            props.cancelledAt ?? null,
            lines,
        );
    }

    addLine(line: InventoryTransferLine): void {
        this.ensureDraft();

        if (line.getTransferId() !== this.id) {
            throw new InvalidInventoryTransferException(
                'La línea no pertenece a esta transferencia',
            );
        }

        const duplicatedLine = this.lines.some(
            (existingLine) =>
                existingLine.getProductId() === line.getProductId() &&
                existingLine.getVariantId() === line.getVariantId(),
        );

        if (duplicatedLine) {
            throw new InvalidInventoryTransferException(
                'El producto/variante ya existe en la transferencia',
            );
        }

        this.lines.push(line);
    }

    removeLine(lineId: string): void {
        this.ensureDraft();

        const index = this.lines.findIndex((l) => l.getId() === lineId);

        if (index === -1) {
            throw new InvalidInventoryTransferException(
                'La línea no existe en esta transferencia',
            );
        }

        this.lines.splice(index, 1);
    }

    /**
     * Inicia el despacho físico en tránsito (mercancía despachada de bodega origen).
     * Transición: DRAFT -> IN_TRANSIT
     * Satisface el ciclo logístico en dos fases reflejado en el enum IN_TRANSIT de schema.prisma.
     */
    dispatch(outboundMovementId?: string): void {
        this.ensureDraft();

        if (!this.lines.length) {
            throw new InvalidInventoryTransferException(
                'Una transferencia debe tener al menos una línea para despacharse',
            );
        }

        this.status = TransferStatus.IN_TRANSIT;
        this.outboundMovementId = outboundMovementId ?? null;
    }

    /**
     * Registra la recepción en bodega de destino de una transferencia en tránsito.
     * Transición: IN_TRANSIT -> COMPLETED
     */
    receive(inboundMovementId?: string, completedById?: string): void {
        if (this.status !== TransferStatus.IN_TRANSIT) {
            throw new InvalidInventoryTransferException(
                'Solo una transferencia en tránsito (IN_TRANSIT) puede recibirse mediante receive()',
            );
        }

        if (!this.lines.length) {
            throw new InvalidInventoryTransferException(
                'Una transferencia debe tener al menos una línea para completarse',
            );
        }

        this.status = TransferStatus.COMPLETED;
        this.inboundMovementId = inboundMovementId ?? this.inboundMovementId;
        this.completedById = completedById ?? this.completedById;
        this.completedAt = new Date();
    }

    /**
     * Traslado atómico directo entre bodegas (HU-08 / HU-INV-10 y Sección 9 de RESUMEN_PROYECTO.md).
     * Transición: DRAFT -> COMPLETED
     * Utilizado para traslados locales inmediatos donde salida y entrada se ejecutan
     * en una sola transacción atómica de base de datos.
     */
    completeAtomic(
        outboundMovementId?: string,
        inboundMovementId?: string,
        completedById?: string,
    ): void {
        this.ensureDraft();

        if (!this.lines.length) {
            throw new InvalidInventoryTransferException(
                'Una transferencia debe tener al menos una línea para completarse',
            );
        }

        this.status = TransferStatus.COMPLETED;
        this.outboundMovementId = outboundMovementId ?? this.outboundMovementId;
        this.inboundMovementId = inboundMovementId ?? this.inboundMovementId;
        this.completedById = completedById ?? this.completedById;
        this.completedAt = new Date();
    }

    /**
     * Método de conveniencia polimórfico para completar la transferencia.
     * - Si está en DRAFT: ejecuta el traslado atómico directo (HU-08).
     * - Si está en IN_TRANSIT: ejecuta la recepción en bodega de destino.
     */
    complete(
        inboundMovementId?: string,
        completedById?: string,
        outboundMovementId?: string,
    ): void {
        if (this.status === TransferStatus.DRAFT) {
            this.completeAtomic(outboundMovementId, inboundMovementId, completedById);
            return;
        }

        if (this.status === TransferStatus.IN_TRANSIT) {
            this.receive(inboundMovementId, completedById);
            return;
        }

        throw new InvalidInventoryTransferException(
            'Solo una transferencia en borrador (DRAFT) o en tránsito (IN_TRANSIT) puede completarse',
        );
    }


    cancel(): void {
        if (
            this.status !== TransferStatus.DRAFT &&
            this.status !== TransferStatus.IN_TRANSIT
        ) {
            throw new InvalidInventoryTransferException(
                'No se puede cancelar una transferencia completada o revertida',
            );
        }

        this.status = TransferStatus.CANCELLED;
        this.cancelledAt = new Date();
    }

    reverse(): void {
        if (this.status !== TransferStatus.COMPLETED) {
            throw new InvalidInventoryTransferException(
                'Solo una transferencia completada puede ser revertida',
            );
        }

        this.status = TransferStatus.REVERSED;
    }

    isDraft(): boolean {
        return this.status === TransferStatus.DRAFT;
    }

    isInTransit(): boolean {
        return this.status === TransferStatus.IN_TRANSIT;
    }

    isCompleted(): boolean {
        return this.status === TransferStatus.COMPLETED;
    }

    isCancelled(): boolean {
        return this.status === TransferStatus.CANCELLED;
    }

    isReversed(): boolean {
        return this.status === TransferStatus.REVERSED;
    }

    getId(): string {
        return this.id;
    }

    getTenantId(): string {
        return this.tenantId;
    }

    getSourceWarehouseId(): string {
        return this.sourceWarehouseId;
    }

    getDestinationWarehouseId(): string {
        return this.destinationWarehouseId;
    }

    getStatus(): TransferStatus {
        return this.status;
    }

    getReference(): TransferReferenceVO {
        return this.reference;
    }

    getNotes(): string | undefined {
        return this.notes;
    }

    getReason(): string | null {
        return this.reason;
    }

    getCreatedById(): string | null {
        return this.createdById;
    }

    getCompletedById(): string | null {
        return this.completedById;
    }

    getOutboundMovementId(): string | null {
        return this.outboundMovementId;
    }

    getInboundMovementId(): string | null {
        return this.inboundMovementId;
    }

    getOccurredAt(): Date {
        return this.occurredAt;
    }

    getCreatedAt(): Date {
        return this.createdAt;
    }

    getCompletedAt(): Date | null {
        return this.completedAt;
    }

    getCancelledAt(): Date | null {
        return this.cancelledAt;
    }

    getLines(): readonly InventoryTransferLine[] {
        return [...this.lines];
    }

    hasLines(): boolean {
        return this.lines.length > 0;
    }

    private ensureDraft(): void {
        if (this.status !== TransferStatus.DRAFT) {
            throw new InvalidInventoryTransferException(
                'La transferencia ya no puede modificarse porque no está en estado borrador',
            );
        }
    }

    private static validateIdentity(props: {
        id: string;
        tenantId: string;
        sourceWarehouseId: string;
        destinationWarehouseId: string;
    }): void {
        if (typeof props.id !== 'string' || !props.id.trim()) {
            throw new InvalidInventoryTransferException(
                'El identificador de la transferencia es obligatorio',
            );
        }

        if (typeof props.tenantId !== 'string' || !props.tenantId.trim()) {
            throw new InvalidInventoryTransferException(
                'La transferencia debe pertenecer a un tenant',
            );
        }

        if (typeof props.sourceWarehouseId !== 'string' || !props.sourceWarehouseId.trim()) {
            throw new InvalidInventoryTransferException(
                'La bodega de origen es obligatoria',
            );
        }

        if (typeof props.destinationWarehouseId !== 'string' || !props.destinationWarehouseId.trim()) {
            throw new InvalidInventoryTransferException(
                'La bodega de destino es obligatoria',
            );
        }

        if (props.sourceWarehouseId === props.destinationWarehouseId) {
            throw new InvalidInventoryTransferException(
                'La bodega de origen y destino deben ser diferentes',
            );
        }
    }

    private static validateStatus(status: TransferStatus): void {
        if (!Object.values(TransferStatus).includes(status)) {
            throw new InvalidInventoryTransferException(
                'El estado de la transferencia no es válido',
            );
        }
    }
}