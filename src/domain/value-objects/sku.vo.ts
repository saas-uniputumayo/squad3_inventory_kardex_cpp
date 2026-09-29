import { InvalidSkuException } from '../exceptions/invalid-sku.exception';

export class SkuVO {
    public static readonly MAX_LENGTH = 50;

    private readonly value: string;

    private constructor(value: string) {
        this.value = value;
    }

    static create(value: string): SkuVO {
        if (typeof value !== 'string') {
            throw new InvalidSkuException('El SKU debe ser una cadena de texto');
        }

        const normalized = value.trim().toUpperCase();

        if (!normalized) {
            throw new InvalidSkuException('El SKU es obligatorio');
        }

        if (normalized.length > SkuVO.MAX_LENGTH) {
            throw new InvalidSkuException(
                `El SKU no puede superar los ${SkuVO.MAX_LENGTH} caracteres`,
            );
        }

        return new SkuVO(normalized);
    }

    getValue(): string {
        return this.value;
    }

    equals(other: SkuVO): boolean {
        if (!other) {
            return false;
        }

        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}