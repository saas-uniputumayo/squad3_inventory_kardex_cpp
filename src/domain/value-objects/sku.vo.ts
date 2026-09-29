import { InvalidSkuException } from '../exceptions/invalid-sku.exception';

export class SkuVO {
    private readonly value: string;

    private constructor(value: string) {
        this.value = value;
    }

    static create(value: string): SkuVO {
        const normalized = value.trim().toUpperCase();

        if (!normalized) {
            throw new InvalidSkuException('El SKU es obligatorio');
        }

        if (normalized.length > 100) {
            throw new InvalidSkuException(
                'El SKU no puede superar los 100 caracteres',
            );
        }

        return new SkuVO(normalized);
    }

    getValue(): string {
        return this.value;
    }

    equals(other: SkuVO): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}