import Decimal from 'decimal.js';

import { InvalidInventoryMovementException } from '../../exceptions/invalid-inventory-movement.exception';
import { MoneyVO } from '../../value-objects/money.vo';
import {
    QuantityRules,
    QuantityVO,
} from '../../value-objects/quantity.vo';
import { UnitCostVO } from '../../value-objects/unit-cost.vo';
import { InventoryPrecisionPolicy } from '../../policy/precision.policy';

export interface CreateInventoryMovementLineProps {
    id: string;
    movementId: string;
    productId: string;
    variantId: string;
    unitOfMeasureId: string;
    allowsFraction: boolean;
    decimalPlaces: number;
    currency?: string;
    quantity: Decimal.Value;
    unitCost: Decimal.Value;
    totalCost?: Decimal.Value;
    lineNumber?: number;
}

export interface InventoryMovementLineProps {
    id: string;
    movementId: string;
    productId: string;
    variantId: string;
    unitOfMeasureId: string;
    allowsFraction: boolean;
    decimalPlaces: number;
    currency: string;
    quantity: QuantityVO;
    unitCost: UnitCostVO;
    totalCost: MoneyVO;
    lineNumber?: number;
    createdAt: Date;
}

export class InventoryMovementLine {
    private constructor(
        private readonly id: string,
        private readonly movementId: string,
        private readonly productId: string,
        private readonly variantId: string,
        private readonly unitOfMeasureId: string,
        private readonly allowsFraction: boolean,
        private readonly decimalPlaces: number,
        private readonly currency: string,
        private readonly quantity: QuantityVO,
        private readonly unitCost: UnitCostVO,
        private readonly totalCost: MoneyVO,
        private readonly lineNumber: number | undefined,
        private readonly createdAt: Date,
    ) { }

    static create(
        props: CreateInventoryMovementLineProps,
    ): InventoryMovementLine {
        InventoryMovementLine.validateIdentity(props);

        const currency =
            props.currency?.trim().toUpperCase() ?? 'COP';

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
            throw new InvalidInventoryMovementException(
                'La cantidad de la línea debe ser mayor que cero',
            );
        }

        const unitCost = UnitCostVO.create(
            props.unitCost,
            currency,
        );

        // totalCost = round(unitCost × quantity, 4)
        const calculatedTotalCost = unitCost.multiply(
            quantity.getAmount(),
        );

        const totalCostAmount = props.totalCost !== undefined && props.totalCost !== null
            ? InventoryPrecisionPolicy.roundInventoryValue(props.totalCost)
            : calculatedTotalCost;

        const totalCost = MoneyVO.create(
            totalCostAmount,
            currency,
        );

        // Validación precision-aware que tolera redondeos comerciales
        if (!InventoryPrecisionPolicy.areValuesEquivalent(totalCost.getAmount(), calculatedTotalCost)) {
            throw new InvalidInventoryMovementException(
                'El costo total de la línea no coincide razonablemente con la cantidad multiplicada por el costo unitario',
            );
        }

        const createdAt = new Date();

        return new InventoryMovementLine(
            props.id,
            props.movementId,
            props.productId,
            props.variantId,
            props.unitOfMeasureId,
            props.allowsFraction,
            props.decimalPlaces,
            currency,
            quantity,
            unitCost,
            totalCost,
            props.lineNumber,
            createdAt,
        );
    }

    static rehydrate(
        props: InventoryMovementLineProps,
    ): InventoryMovementLine {
        InventoryMovementLine.validateIdentity(props);

        const currency = props.currency.trim().toUpperCase();

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
            throw new InvalidInventoryMovementException(
                'La cantidad de la línea debe ser mayor que cero',
            );
        }

        const unitCost = UnitCostVO.create(
            props.unitCost.getAmount(),
            currency,
        );

        const totalCost = MoneyVO.create(
            props.totalCost.getAmount(),
            currency,
        );

        const calculatedTotalCost = unitCost.multiply(
            quantity.getAmount(),
        );

        if (!InventoryPrecisionPolicy.areValuesEquivalent(totalCost.getAmount(), calculatedTotalCost)) {
            throw new InvalidInventoryMovementException(
                'El costo total de la línea no coincide razonablemente con la cantidad multiplicada por el costo unitario',
            );
        }

        if (Number.isNaN(props.createdAt.getTime())) {
            throw new InvalidInventoryMovementException(
                'La fecha de creación de la línea no es válida',
            );
        }

        return new InventoryMovementLine(
            props.id,
            props.movementId,
            props.productId,
            props.variantId,
            props.unitOfMeasureId,
            props.allowsFraction,
            props.decimalPlaces,
            currency,
            quantity,
            unitCost,
            totalCost,
            props.lineNumber,
            props.createdAt,
        );
    }

    getId(): string {
        return this.id;
    }

    getMovementId(): string {
        return this.movementId;
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

    getCurrency(): string {
        return this.currency;
    }

    getQuantity(): QuantityVO {
        return this.quantity;
    }

    getUnitCost(): UnitCostVO {
        return this.unitCost;
    }

    getTotalCost(): MoneyVO {
        return this.totalCost;
    }

    getLineNumber(): number | undefined {
        return this.lineNumber;
    }

    getCreatedAt(): Date {
        return this.createdAt;
    }

    private static validateIdentity(props: {
        id: string;
        movementId: string;
        productId: string;
        variantId: string;
        unitOfMeasureId: string;
        allowsFraction: boolean;
        decimalPlaces: number;
    }): void {
        if (typeof props.id !== 'string' || !props.id.trim()) {
            throw new InvalidInventoryMovementException(
                'El identificador de la línea es obligatorio',
            );
        }

        if (typeof props.movementId !== 'string' || !props.movementId.trim()) {
            throw new InvalidInventoryMovementException(
                'La línea debe pertenecer a un movimiento',
            );
        }

        if (typeof props.productId !== 'string' || !props.productId.trim()) {
            throw new InvalidInventoryMovementException(
                'La línea debe pertenecer a un producto',
            );
        }

        if (typeof props.variantId !== 'string' || !props.variantId.trim()) {
            throw new InvalidInventoryMovementException(
                'La línea debe pertenecer a una variante',
            );
        }

        if (typeof props.unitOfMeasureId !== 'string' || !props.unitOfMeasureId.trim()) {
            throw new InvalidInventoryMovementException(
                'La línea debe tener una unidad de medida',
            );
        }

        if (typeof props.allowsFraction !== 'boolean') {
            throw new InvalidInventoryMovementException(
                'La configuración de fraccionamiento de la unidad no es válida',
            );
        }

        if (
            !Number.isInteger(props.decimalPlaces) ||
            props.decimalPlaces < 0
        ) {
            throw new InvalidInventoryMovementException(
                'La precisión decimal de la unidad no es válida',
            );
        }

        if (!props.allowsFraction && props.decimalPlaces !== 0) {
            throw new InvalidInventoryMovementException(
                'Una unidad que no permite fracciones debe tener cero posiciones decimales',
            );
        }
    }
}