import { InvalidInventoryTransferException } from '../../exceptions/invalid-inventory-transfer.exception';
import { TransferReferenceVO } from '../../value-objects/transfer-reference.vo';
import { InventoryTransferLine } from './line.entity';
import { TransferStatus } from './types';

export interface CreateInventoryTransferProps {
    id: string;
    tenantId: string;
    sourceWarehouseId: string;
    destinationWarehouseId: string;
    reference: TransferReferenceVO;
    notes?: string;
    occurredAt?: Date;
}

export interface InventoryTransferProps {
    id: string;
    tenantId: string;
    sourceWarehouseId: string;
    destinationWarehouseId: string;
    status: TransferStatus;
    reference: TransferReferenceVO;
    notes?: string;
    occurredAt: Date;
    createdAt: Date;
    postedAt?: Date;
    cancelledAt?: Date;
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
        private readonly occurredAt: Date,
        private readonly createdAt: Date,
        private postedAt: Date | undefined,
        private cancelledAt: Date | undefined,
        lines: InventoryTransferLine[] = [],
    ) {
        this.lines = [...lines];
    }

    static create(
        props: CreateInventoryTransferProps,
    ): InventoryTransfer {
        InventoryTransfer.validateIdentity(
            props,
        );

        const notes =
            props.notes?.trim() || undefined;

        if (notes && notes.length > 1000) {
            throw new InvalidInventoryTransferException(
                'Las notas de la transferencia no pueden superar los 1000 caracteres',
            );
        }

        const occurredAt =
            props.occurredAt ?? new Date();

        if (
            Number.isNaN(
                occurredAt.getTime(),
            )
        ) {
            throw new InvalidInventoryTransferException(
                'La fecha de la transferencia no es válida',
            );
        }

        return new InventoryTransfer(
            props.id,
            props.tenantId,
            props.sourceWarehouseId,
            props.destinationWarehouseId,
            TransferStatus.DRAFT,
            props.reference,
            notes,
            occurredAt,
            new Date(),
            undefined,
            undefined,
        );
    }

    static rehydrate(
        props: InventoryTransferProps,
        lines: InventoryTransferLine[] = [],
    ): InventoryTransfer {
        InventoryTransfer.validateIdentity(
            props,
        );

        InventoryTransfer.validateStatus(
            props.status,
        );

        const notes =
            props.notes?.trim() || undefined;

        if (notes && notes.length > 1000) {
            throw new InvalidInventoryTransferException(
                'Las notas de la transferencia no pueden superar los 1000 caracteres',
            );
        }

        if (
            Number.isNaN(
                props.occurredAt.getTime(),
            )
        ) {
            throw new InvalidInventoryTransferException(
                'La fecha de la transferencia no es válida',
            );
        }

        if (
            Number.isNaN(
                props.createdAt.getTime(),
            )
        ) {
            throw new InvalidInventoryTransferException(
                'La fecha de creación de la transferencia no es válida',
            );
        }

        if (
            props.status === TransferStatus.POSTED &&
            !props.postedAt
        ) {
            throw new InvalidInventoryTransferException(
                'Una transferencia publicada debe tener fecha de publicación',
            );
        }

        if (
            props.status === TransferStatus.CANCELLED &&
            !props.cancelledAt
        ) {
            throw new InvalidInventoryTransferException(
                'Una transferencia cancelada debe tener fecha de cancelación',
            );
        }

        if (
            props.status === TransferStatus.DRAFT &&
            (
                props.postedAt ||
                props.cancelledAt
            )
        ) {
            throw new InvalidInventoryTransferException(
                'Una transferencia en borrador no puede tener datos de publicación o cancelación',
            );
        }

        if (
            props.status === TransferStatus.POSTED &&
            props.cancelledAt
        ) {
            throw new InvalidInventoryTransferException(
                'Una transferencia publicada no puede tener fecha de cancelación',
            );
        }

        if (
            props.status === TransferStatus.CANCELLED &&
            props.postedAt
        ) {
            throw new InvalidInventoryTransferException(
                'Una transferencia cancelada no puede tener fecha de publicación',
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
            props.occurredAt,
            props.createdAt,
            props.postedAt,
            props.cancelledAt,
            lines,
        );
    }

    addLine(
        line: InventoryTransferLine,
    ): void {
        this.ensureDraft();

        if (
            line.getTransferId() !== this.id
        ) {
            throw new InvalidInventoryTransferException(
                'La línea no pertenece a esta transferencia',
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
            throw new InvalidInventoryTransferException(
                'El producto ya existe en la transferencia',
            );
        }

        this.lines.push(line);
    }

    removeLine(
        lineId: string,
    ): void {
        this.ensureDraft();

        const index =
            this.lines.findIndex(
                (line) =>
                    line.getId() === lineId,
            );

        if (index === -1) {
            throw new InvalidInventoryTransferException(
                'La línea no existe en esta transferencia',
            );
        }

        this.lines.splice(index, 1);
    }

    post(): void {
        this.ensureDraft();

        if (!this.lines.length) {
            throw new InvalidInventoryTransferException(
                'Una transferencia debe tener al menos una línea',
            );
        }

        this.status =
            TransferStatus.POSTED;

        this.postedAt = new Date();
    }

    cancel(): void {
        this.ensureDraft();

        this.status =
            TransferStatus.CANCELLED;

        this.cancelledAt = new Date();
    }

    isDraft(): boolean {
        return (
            this.status ===
            TransferStatus.DRAFT
        );
    }

    isPosted(): boolean {
        return (
            this.status ===
            TransferStatus.POSTED
        );
    }

    isCancelled(): boolean {
        return (
            this.status ===
            TransferStatus.CANCELLED
        );
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

    getOccurredAt(): Date {
        return this.occurredAt;
    }

    getCreatedAt(): Date {
        return this.createdAt;
    }

    getPostedAt(): Date | undefined {
        return this.postedAt;
    }

    getCancelledAt(): Date | undefined {
        return this.cancelledAt;
    }

    getLines(): readonly InventoryTransferLine[] {
        return [...this.lines];
    }

    hasLines(): boolean {
        return this.lines.length > 0;
    }

    private ensureDraft(): void {
        if (
            this.status !==
            TransferStatus.DRAFT
        ) {
            throw new InvalidInventoryTransferException(
                'La transferencia ya no puede modificarse porque no está en estado borrador',
            );
        }
    }

    private static validateIdentity(
        props: {
            id: string;
            tenantId: string;
            sourceWarehouseId: string;
            destinationWarehouseId: string;
        },
    ): void {
        if (!props.id.trim()) {
            throw new InvalidInventoryTransferException(
                'El identificador de la transferencia es obligatorio',
            );
        }

        if (!props.tenantId.trim()) {
            throw new InvalidInventoryTransferException(
                'La transferencia debe pertenecer a un tenant',
            );
        }

        if (!props.sourceWarehouseId.trim()) {
            throw new InvalidInventoryTransferException(
                'La bodega de origen es obligatoria',
            );
        }

        if (
            !props.destinationWarehouseId.trim()
        ) {
            throw new InvalidInventoryTransferException(
                'La bodega de destino es obligatoria',
            );
        }

        if (
            props.sourceWarehouseId ===
            props.destinationWarehouseId
        ) {
            throw new InvalidInventoryTransferException(
                'La bodega de origen y destino deben ser diferentes',
            );
        }
    }

    private static validateStatus(
        status: TransferStatus,
    ): void {
        if (
            !Object.values(
                TransferStatus,
            ).includes(status)
        ) {
            throw new InvalidInventoryTransferException(
                'El estado de la transferencia no es válido',
            );
        }
    }
}