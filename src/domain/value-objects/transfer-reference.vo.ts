import { InvalidTransferReferenceException } from '../exceptions/invalid-transfer-reference.exception';

export class TransferReferenceVO {
    private static readonly MAX_LENGTH = 100;

    private constructor(
        private readonly value: string,
    ) { }

    static create(
        value: string,
    ): TransferReferenceVO {
        if (typeof value !== 'string') {
            throw new InvalidTransferReferenceException(
                'La referencia de transferencia debe ser una cadena de texto',
            );
        }

        const normalized = value.trim().toUpperCase();

        if (!normalized) {
            throw new InvalidTransferReferenceException(
                'La referencia de transferencia es obligatoria',
            );
        }

        if (normalized.length > TransferReferenceVO.MAX_LENGTH) {
            throw new InvalidTransferReferenceException(
                `La referencia de transferencia no puede superar los ${TransferReferenceVO.MAX_LENGTH} caracteres`,
            );
        }

        return new TransferReferenceVO(normalized);
    }

    getValue(): string {
        return this.value;
    }

    equals(
        other: TransferReferenceVO,
    ): boolean {
        if (!other) {
            return false;
        }

        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}