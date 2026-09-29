import { InvalidInventoryMovementException } from '../../exceptions/invalid-inventory-movement.exception';
import { MoneyVO } from '../../value-objects/money.vo';
import {
    QuantityRules,
    QuantityVO,
} from '../../value-objects/quantity.vo';
import { UnitCostVO } from '../../value-objects/unit-cost.vo';
import {
    MovementSource,
    MovementType,
} from '../inventory-movement/types';

export interface CreateInventoryLedgerEntryProps {
    id: string;
    tenantId: string;
    warehouseId: string;
    movementId: string;
    movementLineId: string;
    productId: string;
    variantId?: string;
    unitOfMeasureId: string;
    allowsFraction: boolean;
    decimalPlaces: number;
    currency?: string;
    movementType: MovementType;
    source: MovementSource;
    quantityIn?: QuantityVO;
    quantityOut?: QuantityVO;
    unitCost: UnitCostVO;
    totalValue: MoneyVO;
    balanceQuantity: QuantityVO;
    balanceValue: MoneyVO;
    balanceAverageCost: UnitCostVO;
    occurredAt: Date;
}

export interface InventoryLedgerEntryProps {
    id: string;
    tenantId: string;
    warehouseId: string;
    movementId: string;
    movementLineId: string;
    productId: string;
    variantId?: string;
    unitOfMeasureId: string;
    allowsFraction: boolean;
    decimalPlaces: number;
    currency: string;
    movementType: MovementType;
    source: MovementSource;
    quantityIn?: QuantityVO;
    quantityOut?: QuantityVO;
    unitCost: UnitCostVO;
    totalValue: MoneyVO;
    balanceQuantity: QuantityVO;
    balanceValue: MoneyVO;
    balanceAverageCost: UnitCostVO;
    occurredAt: Date;
    createdAt: Date;
}

export class InventoryLedgerEntry {
    private constructor(
        private readonly id: string,
        private readonly tenantId: string,
        private readonly warehouseId: string,
        private readonly movementId: string,
        private readonly movementLineId: string,
        private readonly productId: string,
        private readonly variantId: string | undefined,
        private readonly unitOfMeasureId: string,
        private readonly allowsFraction: boolean,
        private readonly decimalPlaces: number,
        private readonly currency: string,
        private readonly movementType: MovementType,
        private readonly source: MovementSource,
        private readonly quantityIn: QuantityVO | undefined,
        private readonly quantityOut: QuantityVO | undefined,
        private readonly unitCost: UnitCostVO,
        private readonly totalValue: MoneyVO,
        private readonly balanceQuantity: QuantityVO,
        private readonly balanceValue: MoneyVO,
        private readonly balanceAverageCost: UnitCostVO,
        private readonly occurredAt: Date,
        private readonly createdAt: Date,
    ) { }

    static create(
        props: CreateInventoryLedgerEntryProps,
    ): InventoryLedgerEntry {
        InventoryLedgerEntry.validateIdentity(
            props,
        );

        InventoryLedgerEntry.validateMovementType(
            props.movementType,
        );

        InventoryLedgerEntry.validateSource(
            props.source,
        );

        const currency =
            props.currency?.trim().toUpperCase() ??
            'COP';

        const quantityRules: QuantityRules = {
            unitOfMeasureId:
                props.unitOfMeasureId,
            allowsFraction:
                props.allowsFraction,
            decimalPlaces:
                props.decimalPlaces,
        };

        const balanceQuantity =
            QuantityVO.create(
                props.balanceQuantity.getAmount(),
                quantityRules,
            );

        const balanceValue =
            MoneyVO.create(
                props.balanceValue.getAmount(),
                currency,
            );

        const balanceAverageCost =
            UnitCostVO.create(
                props.balanceAverageCost.getAmount(),
                currency,
            );

        const unitCost =
            UnitCostVO.create(
                props.unitCost.getAmount(),
                currency,
            );

        const totalValue =
            MoneyVO.create(
                props.totalValue.getAmount(),
                currency,
            );

        const quantityIn =
            props.quantityIn
                ? QuantityVO.create(
                    props.quantityIn.getAmount(),
                    quantityRules,
                )
                : undefined;

        const quantityOut =
            props.quantityOut
                ? QuantityVO.create(
                    props.quantityOut.getAmount(),
                    quantityRules,
                )
                : undefined;

        InventoryLedgerEntry.validateQuantities(
            quantityIn,
            quantityOut,
        );

        InventoryLedgerEntry.validateBalance(
            balanceQuantity,
            balanceValue,
            balanceAverageCost,
            currency,
        );

        InventoryLedgerEntry.validateTotalValue(
            quantityIn,
            quantityOut,
            unitCost,
            totalValue,
        );

        const occurredAt =
            new Date(props.occurredAt);

        if (
            Number.isNaN(
                occurredAt.getTime(),
            )
        ) {
            throw new InvalidInventoryMovementException(
                'La fecha del Kardex no es válida',
            );
        }

        return new InventoryLedgerEntry(
            props.id,
            props.tenantId,
            props.warehouseId,
            props.movementId,
            props.movementLineId,
            props.productId,
            props.variantId,
            props.unitOfMeasureId,
            props.allowsFraction,
            props.decimalPlaces,
            currency,
            props.movementType,
            props.source,
            quantityIn,
            quantityOut,
            unitCost,
            totalValue,
            balanceQuantity,
            balanceValue,
            balanceAverageCost,
            occurredAt,
            new Date(),
        );
    }

    static rehydrate(
        props: InventoryLedgerEntryProps,
    ): InventoryLedgerEntry {
        InventoryLedgerEntry.validateIdentity(
            props,
        );

        InventoryLedgerEntry.validateMovementType(
            props.movementType,
        );

        InventoryLedgerEntry.validateSource(
            props.source,
        );

        const currency =
            props.currency.trim().toUpperCase();

        const quantityRules: QuantityRules = {
            unitOfMeasureId:
                props.unitOfMeasureId,
            allowsFraction:
                props.allowsFraction,
            decimalPlaces:
                props.decimalPlaces,
        };

        const balanceQuantity =
            QuantityVO.create(
                props.balanceQuantity.getAmount(),
                quantityRules,
            );

        const balanceValue =
            MoneyVO.create(
                props.balanceValue.getAmount(),
                currency,
            );

        const balanceAverageCost =
            UnitCostVO.create(
                props.balanceAverageCost.getAmount(),
                currency,
            );

        const unitCost =
            UnitCostVO.create(
                props.unitCost.getAmount(),
                currency,
            );

        const totalValue =
            MoneyVO.create(
                props.totalValue.getAmount(),
                currency,
            );

        const quantityIn =
            props.quantityIn
                ? QuantityVO.create(
                    props.quantityIn.getAmount(),
                    quantityRules,
                )
                : undefined;

        const quantityOut =
            props.quantityOut
                ? QuantityVO.create(
                    props.quantityOut.getAmount(),
                    quantityRules,
                )
                : undefined;

        InventoryLedgerEntry.validateQuantities(
            quantityIn,
            quantityOut,
        );

        InventoryLedgerEntry.validateBalance(
            balanceQuantity,
            balanceValue,
            balanceAverageCost,
            currency,
        );

        InventoryLedgerEntry.validateTotalValue(
            quantityIn,
            quantityOut,
            unitCost,
            totalValue,
        );

        if (
            Number.isNaN(
                props.occurredAt.getTime(),
            )
        ) {
            throw new InvalidInventoryMovementException(
                'La fecha del Kardex no es válida',
            );
        }

        if (
            Number.isNaN(
                props.createdAt.getTime(),
            )
        ) {
            throw new InvalidInventoryMovementException(
                'La fecha de creación del Kardex no es válida',
            );
        }

        return new InventoryLedgerEntry(
            props.id,
            props.tenantId,
            props.warehouseId,
            props.movementId,
            props.movementLineId,
            props.productId,
            props.variantId,
            props.unitOfMeasureId,
            props.allowsFraction,
            props.decimalPlaces,
            currency,
            props.movementType,
            props.source,
            quantityIn,
            quantityOut,
            unitCost,
            totalValue,
            balanceQuantity,
            balanceValue,
            balanceAverageCost,
            props.occurredAt,
            props.createdAt,
        );
    }

    getId(): string {
        return this.id;
    }

    getTenantId(): string {
        return this.tenantId;
    }

    getWarehouseId(): string {
        return this.warehouseId;
    }

    getMovementId(): string {
        return this.movementId;
    }

    getMovementLineId(): string {
        return this.movementLineId;
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

    getCurrency(): string {
        return this.currency;
    }

    getMovementType(): MovementType {
        return this.movementType;
    }

    getSource(): MovementSource {
        return this.source;
    }

    getQuantityIn(): QuantityVO | undefined {
        return this.quantityIn;
    }

    getQuantityOut(): QuantityVO | undefined {
        return this.quantityOut;
    }

    getUnitCost(): UnitCostVO {
        return this.unitCost;
    }

    getTotalValue(): MoneyVO {
        return this.totalValue;
    }

    getBalanceQuantity(): QuantityVO {
        return this.balanceQuantity;
    }

    getBalanceValue(): MoneyVO {
        return this.balanceValue;
    }

    getBalanceAverageCost(): UnitCostVO {
        return this.balanceAverageCost;
    }

    getOccurredAt(): Date {
        return this.occurredAt;
    }

    getCreatedAt(): Date {
        return this.createdAt;
    }

    isInbound(): boolean {
        return this.quantityIn !== undefined;
    }

    isOutbound(): boolean {
        return this.quantityOut !== undefined;
    }

    private static validateIdentity(
        props: {
            id: string;
            tenantId: string;
            warehouseId: string;
            movementId: string;
            movementLineId: string;
            productId: string;
            unitOfMeasureId: string;
            allowsFraction: boolean;
            decimalPlaces: number;
        },
    ): void {
        if (!props.id.trim()) {
            throw new InvalidInventoryMovementException(
                'El identificador del Kardex es obligatorio',
            );
        }

        if (!props.tenantId.trim()) {
            throw new InvalidInventoryMovementException(
                'El Kardex debe pertenecer a un tenant',
            );
        }

        if (!props.warehouseId.trim()) {
            throw new InvalidInventoryMovementException(
                'El Kardex debe pertenecer a una bodega',
            );
        }

        if (!props.movementId.trim()) {
            throw new InvalidInventoryMovementException(
                'El Kardex debe pertenecer a un movimiento',
            );
        }

        if (!props.movementLineId.trim()) {
            throw new InvalidInventoryMovementException(
                'El Kardex debe pertenecer a una línea de movimiento',
            );
        }

        if (!props.productId.trim()) {
            throw new InvalidInventoryMovementException(
                'El Kardex debe pertenecer a un producto',
            );
        }

        if (!props.unitOfMeasureId.trim()) {
            throw new InvalidInventoryMovementException(
                'El Kardex debe tener una unidad de medida',
            );
        }

        if (
            typeof props.allowsFraction !==
            'boolean'
        ) {
            throw new InvalidInventoryMovementException(
                'La configuración de fraccionamiento de la unidad no es válida',
            );
        }

        if (
            !Number.isInteger(
                props.decimalPlaces,
            ) ||
            props.decimalPlaces < 0
        ) {
            throw new InvalidInventoryMovementException(
                'La precisión decimal de la unidad no es válida',
            );
        }

        if (
            !props.allowsFraction &&
            props.decimalPlaces !== 0
        ) {
            throw new InvalidInventoryMovementException(
                'Una unidad que no permite fracciones debe tener cero posiciones decimales',
            );
        }
    }

    private static validateMovementType(
        type: MovementType,
    ): void {
        if (
            !Object.values(
                MovementType,
            ).includes(type)
        ) {
            throw new InvalidInventoryMovementException(
                'El tipo de movimiento del Kardex no es válido',
            );
        }
    }

    private static validateSource(
        source: MovementSource,
    ): void {
        if (
            !Object.values(
                MovementSource,
            ).includes(source)
        ) {
            throw new InvalidInventoryMovementException(
                'El origen del Kardex no es válido',
            );
        }
    }

    private static validateQuantities(
        quantityIn:
            | QuantityVO
            | undefined,
        quantityOut:
            | QuantityVO
            | undefined,
    ): void {
        const hasInbound =
            quantityIn !== undefined;

        const hasOutbound =
            quantityOut !== undefined;

        if (
            hasInbound === hasOutbound
        ) {
            throw new InvalidInventoryMovementException(
                'Una entrada del Kardex debe representar exactamente una entrada o una salida',
            );
        }

        const quantity =
            quantityIn ?? quantityOut;

        if (!quantity || !quantity.isPositive()) {
            throw new InvalidInventoryMovementException(
                'La cantidad del Kardex debe ser mayor que cero',
            );
        }
    }

    private static validateBalance(
        balanceQuantity: QuantityVO,
        balanceValue: MoneyVO,
        balanceAverageCost: UnitCostVO,
        currency: string,
    ): void {
        if (
            balanceValue.getCurrency() !==
            currency
        ) {
            throw new InvalidInventoryMovementException(
                'La moneda del valor del saldo no coincide con la moneda del Kardex',
            );
        }

        if (
            balanceAverageCost.getCurrency() !==
            currency
        ) {
            throw new InvalidInventoryMovementException(
                'La moneda del costo promedio no coincide con la moneda del Kardex',
            );
        }

        if (
            balanceQuantity.isZero()
        ) {
            if (
                !balanceValue
                    .getAmount()
                    .isZero()
            ) {
                throw new InvalidInventoryMovementException(
                    'Un saldo de cero no puede tener valor de inventario',
                );
            }

            if (
                !balanceAverageCost
                    .getAmount()
                    .isZero()
            ) {
                throw new InvalidInventoryMovementException(
                    'Un saldo de cero debe tener costo promedio cero',
                );
            }

            return;
        }

        const expectedValue =
            balanceAverageCost
                .getAmount()
                .mul(
                    balanceQuantity.getAmount(),
                );

        if (
            !expectedValue.eq(
                balanceValue.getAmount(),
            )
        ) {
            throw new InvalidInventoryMovementException(
                'El valor del saldo no coincide con la cantidad multiplicada por el costo promedio',
            );
        }
    }

    private static validateTotalValue(
        quantityIn:
            | QuantityVO
            | undefined,
        quantityOut:
            | QuantityVO
            | undefined,
        unitCost: UnitCostVO,
        totalValue: MoneyVO,
    ): void {
        const quantity =
            quantityIn ?? quantityOut;

        if (!quantity) {
            throw new InvalidInventoryMovementException(
                'El Kardex debe tener una cantidad',
            );
        }

        if (
            totalValue.getCurrency() !==
            unitCost.getCurrency()
        ) {
            throw new InvalidInventoryMovementException(
                'La moneda del valor total no coincide con la moneda del costo unitario',
            );
        }

        const expectedTotal =
            unitCost.multiply(
                quantity.getAmount(),
            );

        if (
            !expectedTotal.eq(
                totalValue.getAmount(),
            )
        ) {
            throw new InvalidInventoryMovementException(
                'El valor total del Kardex no coincide con la cantidad multiplicada por el costo unitario',
            );
        }
    }
}