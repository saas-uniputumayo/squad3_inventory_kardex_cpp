import { InvalidWarehouseException } from '../exceptions/invalid-warehouse.exception';

export class WarehouseCodeVO {
    private static readonly MAX_LENGTH = 50;

    private readonly value: string;

    private constructor(value: string) {
        this.value = value;
    }

    static create(value: string): WarehouseCodeVO {
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
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}