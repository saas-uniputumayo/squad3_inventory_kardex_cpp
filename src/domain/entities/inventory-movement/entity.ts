import { InvalidInventoryMovementException } from '../../exceptions/invalid-inventory-movement.exception';
import { MovementReferenceVO } from '../../value-objects/movement-reference.vo';
import { InventoryMovementLine } from './line.entity';
import {
    MovementSource,
    MovementStatus,
    MovementType,
} from '../../types';

export interface CreateInventoryMovementProps {
    id: string;
    tenantId: string;
    warehouseId: string;
    type: MovementType;
    source: MovementSource;
    reference: MovementReferenceVO;
    status?: MovementStatus;
    notes?: string;
    occurredAt?: Date;
    lines: InventoryMovementLine[];
}

export interface InventoryMovementProps {
    id: string;
    tenantId: string;
    warehouseId: string;
    type: MovementType;
    status: MovementStatus;
    source: MovementSource;
    reference: MovementReferenceVO;
    notes?: string;
    occurredAt: Date;
    createdAt: Date;
    postedAt?: Date;
    reversedAt?: Date;
    reversalMovementId?: string;
}

export class InventoryMovement {
    private readonly lines: InventoryMovementLine[] = [];

    private constructor(
        private readonly id: string,
        private readonly tenantId: string,
        private readonly warehouseId: string,
        private readonly type: MovementType,
        private status: MovementStatus,
        private readonly source: MovementSource,
        private readonly reference: MovementReferenceVO,
        private readonly notes: string | undefined,
        private readonly occurredAt: Date,
        private readonly createdAt: Date,
        private postedAt: Date | undefined,
        private reversedAt: Date | undefined,
        private reversalMovementId: string | undefined,
        lines: InventoryMovementLine[] = [],
    ) {
        this.lines = [...lines];
    }

    static create(
        props: CreateInventoryMovementProps,
    ): InventoryMovement {
        InventoryMovement.validateIdentity(props);
        InventoryMovement.validateType(props.type);
        InventoryMovement.validateSource(props.source);
        InventoryMovement.validateReference(props.reference);

        const notes = props.notes?.trim() || undefined;

        if (notes && notes.length > 1000) {
            throw new InvalidInventoryMovementException(
                'Las notas del movimiento no pueden superar los 1000 caracteres',
            );
        }

        const occurredAt = props.occurredAt ?? new Date();

        if (Number.isNaN(occurredAt.getTime())) {
            throw new InvalidInventoryMovementException(
                'La fecha del movimiento no es válida',
            );
        }

        const status = props.status ?? MovementStatus.POSTED;
        const now = new Date();
        const postedAt = status === MovementStatus.POSTED ? now : undefined;

        const movement = new InventoryMovement(
            props.id,
            props.tenantId,
            props.warehouseId,
            props.type,
            status,
            props.source,
            props.reference,
            notes,
            occurredAt,
            now,
            postedAt,
            undefined,
            undefined,
            props.lines,
        );

        movement.validateLines();

        return movement;
    }

    static rehydrate(
        props: InventoryMovementProps,
        lines: InventoryMovementLine[] = [],
    ): InventoryMovement {
        InventoryMovement.validateIdentity(props);
        InventoryMovement.validateType(props.type);
        InventoryMovement.validateStatus(props.status);
        InventoryMovement.validateSource(props.source);
        InventoryMovement.validateReference(props.reference);

        const notes = props.notes?.trim() || undefined;

        if (notes && notes.length > 1000) {
            throw new InvalidInventoryMovementException(
                'Las notas del movimiento no pueden superar los 1000 caracteres',
            );
        }

        if (Number.isNaN(props.occurredAt.getTime())) {
            throw new InvalidInventoryMovementException(
                'La fecha del movimiento no es válida',
            );
        }

        if (Number.isNaN(props.createdAt.getTime())) {
            throw new InvalidInventoryMovementException(
                'La fecha de creación del movimiento no es válida',
            );
        }

        if (
            props.status === MovementStatus.REVERSED &&
            !props.reversedAt
        ) {
            throw new InvalidInventoryMovementException(
                'Un movimiento revertido debe tener fecha de reversión',
            );
        }

        if (
            props.status === MovementStatus.REVERSED &&
            !props.reversalMovementId?.trim()
        ) {
            throw new InvalidInventoryMovementException(
                'Un movimiento revertido debe tener identificado su movimiento de reversión',
            );
        }

        if (
            props.status !== MovementStatus.REVERSED &&
            (props.reversedAt || props.reversalMovementId)
        ) {
            throw new InvalidInventoryMovementException(
                'Un movimiento no revertido no puede tener datos de reversión',
            );
        }

        const reversalMovementId = props.reversalMovementId?.trim() || undefined;

        if (reversalMovementId === props.id) {
            throw new InvalidInventoryMovementException(
                'Un movimiento no puede revertirse a sí mismo',
            );
        }

        const movement = new InventoryMovement(
            props.id,
            props.tenantId,
            props.warehouseId,
            props.type,
            props.status,
            props.source,
            props.reference,
            notes,
            props.occurredAt,
            props.createdAt,
            props.postedAt,
            props.reversedAt,
            reversalMovementId,
            lines,
        );

        movement.validateLines();

        return movement;
    }

    post(): void {
        if (this.status === MovementStatus.POSTED) {
            return;
        }

        if (this.status === MovementStatus.REVERSED) {
            throw new InvalidInventoryMovementException(
                'No se puede asentar un movimiento revertido',
            );
        }

        this.status = MovementStatus.POSTED;
        this.postedAt = new Date();
    }

    markAsReversed(reversalMovementId: string): void {
        if (this.status === MovementStatus.REVERSED) {
            throw new InvalidInventoryMovementException(
                'El movimiento ya fue revertido',
            );
        }

        if (this.status !== MovementStatus.POSTED) {
            throw new InvalidInventoryMovementException(
                'Solo se pueden revertir movimientos previamente asentados (POSTED)',
            );
        }

        if (!this.lines.length) {
            throw new InvalidInventoryMovementException(
                'No se puede revertir un movimiento sin líneas',
            );
        }

        const normalizedId = reversalMovementId ? reversalMovementId.trim() : '';

        if (!normalizedId) {
            throw new InvalidInventoryMovementException(
                'El movimiento de reversión es obligatorio',
            );
        }

        if (normalizedId === this.id) {
            throw new InvalidInventoryMovementException(
                'Un movimiento no puede revertirse a sí mismo',
            );
        }

        this.status = MovementStatus.REVERSED;
        this.reversalMovementId = normalizedId;
        this.reversedAt = new Date();
    }

    isDraft(): boolean {
        return this.status === MovementStatus.DRAFT;
    }

    isPosted(): boolean {
        return this.status === MovementStatus.POSTED;
    }

    isReversed(): boolean {
        return this.status === MovementStatus.REVERSED;
    }

    /**
     * Determina si el tipo de movimiento representa un incremento físico de stock.
     */
    isInbound(): boolean {
        return (
            this.type === MovementType.PURCHASE_RECEIPT ||
            this.type === MovementType.TRANSFER_IN ||
            this.type === MovementType.ADJUSTMENT_IN ||
            this.type === MovementType.CUSTOMER_RETURN ||
            this.type === MovementType.VOID_RETURN
        );
    }

    /**
     * Determina si el tipo de movimiento representa una disminución física de stock.
     */
    isOutbound(): boolean {
        return (
            this.type === MovementType.SALE_DISPATCH ||
            this.type === MovementType.TRANSFER_OUT ||
            this.type === MovementType.SHRINKAGE_LOSS ||
            this.type === MovementType.DAMAGE_LOSS ||
            this.type === MovementType.ADJUSTMENT_OUT ||
            this.type === MovementType.SUPPLIER_RETURN
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

    getType(): MovementType {
        return this.type;
    }

    getStatus(): MovementStatus {
        return this.status;
    }

    getSource(): MovementSource {
        return this.source;
    }

    getReference(): MovementReferenceVO {
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

    getReversedAt(): Date | undefined {
        return this.reversedAt;
    }

    getReversalMovementId(): string | undefined {
        return this.reversalMovementId;
    }

    getLines(): readonly InventoryMovementLine[] {
        return [...this.lines];
    }

    hasLines(): boolean {
        return this.lines.length > 0;
    }

    private validateLines(): void {
        if (!this.lines.length) {
            throw new InvalidInventoryMovementException(
                'Un movimiento debe tener al menos una línea',
            );
        }

        for (const line of this.lines) {
            if (line.getMovementId() !== this.id) {
                throw new InvalidInventoryMovementException(
                    'Todas las líneas deben pertenecer al movimiento',
                );
            }
        }

        const combinations = new Set<string>();

        for (const line of this.lines) {
            const key = `${line.getProductId()}:${line.getVariantId()}`;

            if (combinations.has(key)) {
                throw new InvalidInventoryMovementException(
                    'Un producto o variante no puede repetirse dentro del mismo movimiento',
                );
            }

            combinations.add(key);
        }
    }

    private static validateIdentity(props: {
        id: string;
        tenantId: string;
        warehouseId: string;
    }): void {
        if (typeof props.id !== 'string' || !props.id.trim()) {
            throw new InvalidInventoryMovementException(
                'El identificador del movimiento es obligatorio',
            );
        }

        if (typeof props.tenantId !== 'string' || !props.tenantId.trim()) {
            throw new InvalidInventoryMovementException(
                'El movimiento debe pertenecer a un tenant',
            );
        }

        if (typeof props.warehouseId !== 'string' || !props.warehouseId.trim()) {
            throw new InvalidInventoryMovementException(
                'El movimiento debe pertenecer a una bodega',
            );
        }
    }

    private static validateType(type: MovementType): void {
        if (!Object.values(MovementType).includes(type)) {
            throw new InvalidInventoryMovementException(
                'El tipo de movimiento no es válido',
            );
        }
    }

    private static validateStatus(status: MovementStatus): void {
        if (!Object.values(MovementStatus).includes(status)) {
            throw new InvalidInventoryMovementException(
                'El estado del movimiento no es válido',
            );
        }
    }

    private static validateSource(source: MovementSource): void {
        if (!Object.values(MovementSource).includes(source)) {
            throw new InvalidInventoryMovementException(
                'El origen del movimiento no es válido',
            );
        }
    }

    private static validateReference(reference: MovementReferenceVO): void {
        if (!reference) {
            throw new InvalidInventoryMovementException(
                'La referencia del movimiento es obligatoria',
            );
        }
    }
}