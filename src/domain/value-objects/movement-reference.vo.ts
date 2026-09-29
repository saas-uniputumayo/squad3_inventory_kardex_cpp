import { InvalidInventoryMovementException } from '../exceptions/invalid-inventory-movement.exception';
import { ReferenceType } from '../entities/inventory-movement/types';

export class MovementReferenceVO {
    private constructor(
        private readonly type: ReferenceType,
        private readonly id: string | undefined,
    ) { }

    static create(
        type: ReferenceType,
        id?: string,
    ): MovementReferenceVO {
        if (
            !Object.values(ReferenceType).includes(type)
        ) {
            throw new InvalidInventoryMovementException(
                'El tipo de referencia del movimiento no es válido',
            );
        }

        const normalizedId =
            id?.trim() || undefined;

        if (
            type !== ReferenceType.SYSTEM &&
            !normalizedId
        ) {
            throw new InvalidInventoryMovementException(
                `La referencia ${type} requiere un identificador`,
            );
        }

        return new MovementReferenceVO(
            type,
            normalizedId,
        );
    }

    getType(): ReferenceType {
        return this.type;
    }

    getId(): string | undefined {
        return this.id;
    }

    isSystemReference(): boolean {
        return (
            this.type === ReferenceType.SYSTEM
        );
    }

    equals(
        other: MovementReferenceVO,
    ): boolean {
        return (
            this.type === other.type &&
            this.id === other.id
        );
    }

    toString(): string {
        if (!this.id) {
            return this.type;
        }

        return `${this.type}:${this.id}`;
    }
}