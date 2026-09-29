import Decimal from 'decimal.js';

import { InvalidInventoryTransferLineException } from '../../exceptions/invalid-inventory-transfer-line.exception';
import {
    QuantityRules,
    QuantityVO,
} from '../../value-objects/quantity.vo';
import { UnitCostVO } from '../../value-objects/unit-cost.vo';
import { MoneyVO } from '../../value-objects/money.vo';
import { InventoryPrecisionPolicy } from '../../policy/precision.policy';

export interface CreateInventoryTransferLineProps {
    id: string;
    transferId: string;
    productId: string;
    variantId: string;
    unitOfMeasureId: string;
    allowsFraction: boolean;
    decimalPlaces: number;
    quantity: Decimal.Value;
    transferUnitCost?: Decimal.Value;
    transferTotalCost?: Decimal.Value;
    lineNumber?: number;
    currency?: string;
}

export interface InventoryTransferLineProps {
    id: string;
    transferId: string;
    productId: string;
    variantId: string;
    unitOfMeasureId: string;
    allowsFraction: boolean;
    decimalPlaces: number;
    quantity: QuantityVO;
    transferUnitCost?: UnitCostVO;
    transferTotalCost?: MoneyVO;
    lineNumber?: number;
    createdAt: Date;
}

export class InventoryTransferLine {
    private constructor(
        private readonly id: string,
        private readonly transferId: string,
        private readonly productId: string,
        private readonly variantId: string,
        private readonly unitOfMeasureId: string,
        private readonly allowsFraction: boolean,
        private readonly decimalPlaces: number,
        private readonly quantity: QuantityVO,
        private readonly transferUnitCost: UnitCostVO | undefined,
        private readonly transferTotalCost: MoneyVO | undefined,
        private readonly lineNumber: number | undefined,
        private readonly createdAt: Date,
    ) { }

    static create(
        props: CreateInventoryTransferLineProps,
    ): InventoryTransferLine {
        InventoryTransferLine.validateIdentity(props);

        const quantityRules: QuantityRules = {
            unitOfMeasureId: props.unitOfMeasureId,
            allowsFraction: props.allowsFraction,
            decimalPlaces: props.decimalPlaces,
        };

        const quantity = QuantityVO.create(
            props.quantity,
            quantityRules,
        );

        if (!quantity.isPositive()) {
            throw new InvalidInventoryTransferLineException(
                'La cantidad a transferir debe ser mayor que cero',
            );
        }

        const currency = props.currency?.trim().toUpperCase() ?? 'COP';

        let unitCostVO: UnitCostVO | undefined;
        let totalCostVO: MoneyVO | undefined;

        if (props.transferUnitCost !== undefined && props.transferUnitCost !== null) {
            unitCostVO = UnitCostVO.create(props.transferUnitCost, currency);

            const calculatedTotal = unitCostVO.multiply(quantity.getAmount());
            const totalCostAmount = props.transferTotalCost !== undefined && props.transferTotalCost !== null
                ? InventoryPrecisionPolicy.roundInventoryValue(props.transferTotalCost)
                : calculatedTotal;

            totalCostVO = MoneyVO.create(totalCostAmount, currency);

            if (!InventoryPrecisionPolicy.areValuesEquivalent(totalCostVO.getAmount(), calculatedTotal)) {
                throw new InvalidInventoryTransferLineException(
                    'El costo total de la transferencia no coincide razonablemente con la cantidad multiplicada por el costo unitario',
                );
            }
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
            unitCostVO,
            totalCostVO,
            props.lineNumber,
            new Date(),
        );
    }

    static rehydrate(
        props: InventoryTransferLineProps,
    ): InventoryTransferLine {
        InventoryTransferLine.validateIdentity(props);

        const quantityRules: QuantityRules = {
            unitOfMeasureId: props.unitOfMeasureId,
            allowsFraction: props.allowsFraction,
            decimalPlaces: props.decimalPlaces,
        };

        const quantity = QuantityVO.create(
            props.quantity.getAmount(),
            quantityRules,
        );

        if (!quantity.isPositive()) {
            throw new InvalidInventoryTransferLineException(
                'La cantidad a transferir debe ser mayor que cero',
            );
        }

        if (Number.isNaN(props.createdAt.getTime())) {
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
            props.transferUnitCost,
            props.transferTotalCost,
            props.lineNumber,
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

    getVariantId(): string {
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

    getTransferUnitCost(): UnitCostVO | undefined {
        return this.transferUnitCost;
    }

    getTransferTotalCost(): MoneyVO | undefined {
        return this.transferTotalCost;
    }

    getLineNumber(): number | undefined {
        return this.lineNumber;
    }

    getCreatedAt(): Date {
        return this.createdAt;
    }

    private static validateIdentity(props: {
        id: string;
        transferId: string;
        productId: string;
        variantId: string;
        unitOfMeasureId: string;
        allowsFraction: boolean;
        decimalPlaces: number;
    }): void {
        if (typeof props.id !== 'string' || !props.id.trim()) {
            throw new InvalidInventoryTransferLineException(
                'El identificador de la línea es obligatorio',
            );
        }

        if (typeof props.transferId !== 'string' || !props.transferId.trim()) {
            throw new InvalidInventoryTransferLineException(
                'La línea debe pertenecer a una transferencia',
            );
        }

        if (typeof props.productId !== 'string' || !props.productId.trim()) {
            throw new InvalidInventoryTransferLineException(
                'La línea debe pertenecer a un producto',
            );
        }

        if (typeof props.variantId !== 'string' || !props.variantId.trim()) {
            throw new InvalidInventoryTransferLineException(
                'La línea debe pertenecer a una variante',
            );
        }

        if (typeof props.unitOfMeasureId !== 'string' || !props.unitOfMeasureId.trim()) {
            throw new InvalidInventoryTransferLineException(
                'La línea debe tener una unidad de medida',
            );
        }

        if (typeof props.allowsFraction !== 'boolean') {
            throw new InvalidInventoryTransferLineException(
                'La configuración de fraccionamiento de la unidad no es válida',
            );
        }

        if (
            !Number.isInteger(props.decimalPlaces) ||
            props.decimalPlaces < 0
        ) {
            throw new InvalidInventoryTransferLineException(
                'La precisión decimal de la unidad no es válida',
            );
        }

        if (!props.allowsFraction && props.decimalPlaces !== 0) {
            throw new InvalidInventoryTransferLineException(
                'Una unidad que no permite fracciones debe tener cero posiciones decimales',
            );
        }
    }
}