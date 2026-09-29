import { InvalidUnitOfMeasureException } from '../exceptions/invalid-unit-of-measure.exception';

export class UnitOfMeasureCodeVO {
    public static readonly MAX_LENGTH = 20;

    private readonly value: string;

    private constructor(value: string) {
        this.value = value;
    }

    static create(value: string): UnitOfMeasureCodeVO {
        if (typeof value !== 'string') {
            throw new InvalidUnitOfMeasureException(
                'El código de la unidad de medida debe ser una cadena de texto',
            );
        }

        const normalized = value.trim().toUpperCase();

        if (!normalized) {
            throw new InvalidUnitOfMeasureException(
                'El código de la unidad de medida es obligatorio',
            );
        }

        if (normalized.length > UnitOfMeasureCodeVO.MAX_LENGTH) {
            throw new InvalidUnitOfMeasureException(
                `El código de la unidad de medida no puede superar los ${UnitOfMeasureCodeVO.MAX_LENGTH} caracteres`,
            );
        }

        if (!/^[A-Z0-9_-]+$/.test(normalized)) {
            throw new InvalidUnitOfMeasureException(
                'El código de la unidad de medida solo puede contener letras, números, guion y guion bajo',
            );
        }

        return new UnitOfMeasureCodeVO(normalized);
    }

    getValue(): string {
        return this.value;
    }

    equals(other: UnitOfMeasureCodeVO): boolean {
        if (!other) {
            return false;
        }

        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}