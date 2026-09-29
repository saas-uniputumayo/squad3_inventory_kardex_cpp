import { InvalidWarehouseException } from '../exceptions/invalid-warehouse.exception';

export class WarehouseCodeVO {
    public static readonly MAX_LENGTH = 20;

    private readonly value: string;

    private constructor(value: string) {
        this.value = value;
    }

    static create(value: string): WarehouseCodeVO {
        if (typeof value !== 'string') {
            throw new InvalidWarehouseException(
                'El código de la bodega debe ser una cadena de texto',
            );
        }

        const normalized = value.trim().toUpperCase();

        if (!normalized) {
            throw new InvalidWarehouseException(
                'El código de la bodega es obligatorio',
            );
        }

        if (normalized.length > WarehouseCodeVO.MAX_LENGTH) {
            throw new InvalidWarehouseException(
                `El código de la bodega no puede superar los ${WarehouseCodeVO.MAX_LENGTH} caracteres`,
            );
        }

        return new WarehouseCodeVO(normalized);
    }

    getValue(): string {
        return this.value;
    }

    equals(other: WarehouseCodeVO): boolean {
        if (!other) {
            return false;
        }

        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}