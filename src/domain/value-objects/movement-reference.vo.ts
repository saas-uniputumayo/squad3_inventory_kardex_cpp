import { InvalidMovementReferenceException } from '../exceptions/invalid-movement-reference.exception';
import { ReferenceType } from '../types';

export class MovementReferenceVO {
    private constructor(
        private readonly type: ReferenceType,
        private readonly id: string | undefined,
    ) { }

    static create(
        type: ReferenceType,
        id?: string,
    ): MovementReferenceVO {
        if (!type || !Object.values(ReferenceType).includes(type)) {
            throw new InvalidMovementReferenceException(
                'El tipo de referencia del movimiento no es válido',
            );
        }

        const normalizedId =
            typeof id === 'string' ? id.trim() || undefined : undefined;

        if (type !== ReferenceType.OTHER && !normalizedId) {
            throw new InvalidMovementReferenceException(
                `La referencia ${type} requiere un identificador`,
            );
        }

        return new MovementReferenceVO(type, normalizedId);
    }

    getType(): ReferenceType {
        return this.type;
    }

    getId(): string | undefined {
        return this.id;
    }

    equals(other: MovementReferenceVO): boolean {
        if (!other) {
            return false;
        }

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