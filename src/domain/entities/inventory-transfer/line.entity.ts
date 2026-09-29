import { InvalidInventoryTransferLineException } from '../../exceptions/invalid-inventory-transfer-line.exception';
import {
    QuantityRules,
    QuantityVO,
} from '../../value-objects/quantity.vo';

export interface CreateInventoryTransferLineProps {
    id: string;
    transferId: string;
    productId: string;
    variantId?: string;
    unitOfMeasureId: string;
    allowsFraction: boolean;
    decimalPlaces: number;
    quantity: QuantityVO;
}

export interface InventoryTransferLineProps {
    id: string;
    transferId: string;
    productId: string;
    variantId?: string;
    unitOfMeasureId: string;
    allowsFraction: boolean;
    decimalPlaces: number;
    quantity: QuantityVO;
    createdAt: Date;
}

export class InventoryTransferLine {
    private constructor(
        private readonly id: string,
        private readonly transferId: string,
        private readonly productId: string,
        private readonly variantId:
            | string
            | undefined,
        private readonly unitOfMeasureId: string,
        private readonly allowsFraction: boolean,
        private readonly decimalPlaces: number,
        private readonly quantity: QuantityVO,
        private readonly createdAt: Date,
    ) { }

    static create(
        props: CreateInventoryTransferLineProps,
    ): InventoryTransferLine {
        InventoryTransferLine.validateIdentity(
            props,
        );

        const quantityRules: QuantityRules = {
            unitOfMeasureId:
                props.unitOfMeasureId,
            allowsFraction:
                props.allowsFraction,
            decimalPlaces:
                props.decimalPlaces,
        };

        const quantity =
            QuantityVO.create(
                props.quantity.getAmount(),
                quantityRules,
            );

        if (!quantity.isPositive()) {
            throw new InvalidInventoryTransferLineException(
                'La cantidad a transferir debe ser mayor que cero',
            );
        }

        return new InventoryTransferLine(
            props.id,
            props.transferId,
            props.productId,
            props.variantId,
            props.unitOfMeasureId,
            props.allowsFraction,
            props.decimalPlaces,
            quantity,
            new Date(),
        );
    }

    static rehydrate(
        props: InventoryTransferLineProps,
    ): InventoryTransferLine {
        InventoryTransferLine.validateIdentity(
            props,
        );

        const quantityRules: QuantityRules = {
            unitOfMeasureId:
                props.unitOfMeasureId,
            allowsFraction:
                props.allowsFraction,
            decimalPlaces:
                props.decimalPlaces,
        };

        const quantity =
            QuantityVO.create(
                props.quantity.getAmount(),
                quantityRules,
            );

        if (!quantity.isPositive()) {
            throw new InvalidInventoryTransferLineException(
                'La cantidad a transferir debe ser mayor que cero',
            );
        }

        if (
            Number.isNaN(
                props.createdAt.getTime(),
            )
        ) {
            throw new InvalidInventoryTransferLineException(
                'La fecha de creación de la línea no es válida',
            );
        }

        return new InventoryTransferLine(
            props.id,
            props.transferId,
            props.productId,
            props.variantId,
            props.unitOfMeasureId,
            props.allowsFraction,
            props.decimalPlaces,
            quantity,
            props.createdAt,
        );
    }

    getId(): string {
        return this.id;
    }

    getTransferId(): string {
        return this.transferId;
    }

    getProductId(): string {
        return this.productId;
    }

    getVariantId(): string | undefined {
        return this.variantId;
    }

    getUnitOfMeasureId(): string {
        return this.unitOfMeasureId;
    }

    getAllowsFraction(): boolean {
        return this.allowsFraction;
    }

    getDecimalPlaces(): number {
        return this.decimalPlaces;
    }

    getQuantity(): QuantityVO {
        return this.quantity;
    }

    getCreatedAt(): Date {
        return this.createdAt;
    }

    private static validateIdentity(
        props: {
            id: string;
            transferId: string;
            productId: string;
            unitOfMeasureId: string;
            allowsFraction: boolean;
            decimalPlaces: number;
        },
    ): void {
        if (!props.id.trim()) {
            throw new InvalidInventoryTransferLineException(
                'El identificador de la línea es obligatorio',
            );
        }

        if (!props.transferId.trim()) {
            throw new InvalidInventoryTransferLineException(
                'La línea debe pertenecer a una transferencia',
            );
        }

        if (!props.productId.trim()) {
            throw new InvalidInventoryTransferLineException(
                'La línea debe pertenecer a un producto',
            );
        }

        if (!props.unitOfMeasureId.trim()) {
            throw new InvalidInventoryTransferLineException(
                'La línea debe tener una unidad de medida',
            );
        }

        if (
            typeof props.allowsFraction !==
            'boolean'
        ) {
            throw new InvalidInventoryTransferLineException(
                'La configuración de fraccionamiento de la unidad no es válida',
            );
        }

        if (
            !Number.isInteger(
                props.decimalPlaces,
            ) ||
            props.decimalPlaces < 0
        ) {
            throw new InvalidInventoryTransferLineException(
                'La precisión decimal de la unidad no es válida',
            );
        }

        if (
            !props.allowsFraction &&
            props.decimalPlaces !== 0
        ) {
            throw new InvalidInventoryTransferLineException(
                'Una unidad que no permite fracciones debe tener cero posiciones decimales',
            );
        }
    }
}