import Decimal from 'decimal.js';

import { InvalidInventoryLedgerEntryException } from '../../exceptions/invalid-inventory-ledger-entry.exception';
import { MoneyVO } from '../../value-objects/money.vo';
import {
    QuantityRules,
    QuantityVO,
} from '../../value-objects/quantity.vo';
import { UnitCostVO } from '../../value-objects/unit-cost.vo';
import { InventoryPrecisionPolicy } from '../../policy/precision.policy';
import {
    MovementSource,
    MovementType,
    ReferenceType,
} from '../../types';

export interface CreateInventoryLedgerEntryProps {
    id: string;
    tenantId: string;
    warehouseId: string;
    movementId: string;
    movementLineId: string;
    productId: string;
    variantId: string;
    unitOfMeasureId: string;
    allowsFraction: boolean;
    decimalPlaces: number;
    currency?: string;
    sequence?: bigint | null;
    movementType: MovementType;
    source: MovementSource;
    quantityIn?: QuantityVO;
    quantityOut?: QuantityVO;
    unitCost: UnitCostVO;
    totalValue: MoneyVO;
    balanceQuantity: QuantityVO;
    balanceValue: MoneyVO;
    balanceAverageCost: UnitCostVO;
    averageCostBefore?: UnitCostVO;
    averageCostAfter?: UnitCostVO;
    inventoryValueBefore?: MoneyVO;
    inventoryValueAfter?: MoneyVO;
    referenceType?: ReferenceType;
    referenceId?: string;
    referenceDocument?: string;
    occurredAt?: Date;
}

export interface InventoryLedgerEntryProps {
    id: string;
    tenantId: string;
    warehouseId: string;
    movementId: string;
    movementLineId: string;
    productId: string;
    variantId: string;
    unitOfMeasureId: string;
    allowsFraction: boolean;
    decimalPlaces: number;
    currency: string;
    sequence?: bigint | null;
    movementType: MovementType;
    source: MovementSource;
    quantityIn?: QuantityVO;
    quantityOut?: QuantityVO;
    unitCost: UnitCostVO;
    totalValue: MoneyVO;
    balanceQuantity: QuantityVO;
    balanceValue: MoneyVO;
    balanceAverageCost: UnitCostVO;
    averageCostBefore?: UnitCostVO;
    averageCostAfter?: UnitCostVO;
    inventoryValueBefore?: MoneyVO;
    inventoryValueAfter?: MoneyVO;
    referenceType?: ReferenceType;
    referenceId?: string;
    referenceDocument?: string;
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
        private readonly variantId: string,
        private readonly unitOfMeasureId: string,
        private readonly allowsFraction: boolean,
        private readonly decimalPlaces: number,
        private readonly currency: string,
        private readonly sequence: bigint | null,
        private readonly movementType: MovementType,
        private readonly source: MovementSource,
        private readonly quantityIn: QuantityVO | undefined,
        private readonly quantityOut: QuantityVO | undefined,
        private readonly unitCost: UnitCostVO,
        private readonly totalValue: MoneyVO,
        private readonly balanceQuantity: QuantityVO,
        private readonly balanceValue: MoneyVO,
        private readonly balanceAverageCost: UnitCostVO,
        private readonly averageCostBefore: UnitCostVO | undefined,
        private readonly averageCostAfter: UnitCostVO | undefined,
        private readonly inventoryValueBefore: MoneyVO | undefined,
        private readonly inventoryValueAfter: MoneyVO | undefined,
        private readonly referenceType: ReferenceType | undefined,
        private readonly referenceId: string | undefined,
        private readonly referenceDocument: string | undefined,
        private readonly occurredAt: Date,
        private readonly createdAt: Date,
    ) { }

    static create(
        props: CreateInventoryLedgerEntryProps,
    ): InventoryLedgerEntry {
        InventoryLedgerEntry.validateIdentity(props);
        InventoryLedgerEntry.validateMovementType(props.movementType);
        InventoryLedgerEntry.validateSource(props.source);

        const currency =
            props.currency?.trim().toUpperCase() ?? 'COP';

        const quantityRules: QuantityRules = {
            unitOfMeasureId: props.unitOfMeasureId,
            allowsFraction: props.allowsFraction,
            decimalPlaces: props.decimalPlaces,
        };

        const balanceQuantity = QuantityVO.create(
            props.balanceQuantity.getAmount(),
            quantityRules,
        );

        const balanceValue = MoneyVO.create(
            props.balanceValue.getAmount(),
            currency,
        );

        const balanceAverageCost = UnitCostVO.create(
            props.balanceAverageCost.getAmount(),
            currency,
        );

        const unitCost = UnitCostVO.create(
            props.unitCost.getAmount(),
            currency,
        );

        const totalValue = MoneyVO.create(
            props.totalValue.getAmount(),
            currency,
        );

        const quantityIn =
            props.quantityIn && props.quantityIn.isPositive()
                ? QuantityVO.create(props.quantityIn.getAmount(), quantityRules)
                : undefined;

        const quantityOut =
            props.quantityOut && props.quantityOut.isPositive()
                ? QuantityVO.create(props.quantityOut.getAmount(), quantityRules)
                : undefined;


        InventoryLedgerEntry.validateQuantities(quantityIn, quantityOut);
        InventoryLedgerEntry.validateBalance(balanceQuantity, balanceValue, balanceAverageCost, currency);
        InventoryLedgerEntry.validateTotalValue(quantityIn, quantityOut, unitCost, totalValue);

        const occurredAt = props.occurredAt ? new Date(props.occurredAt) : new Date();

        if (Number.isNaN(occurredAt.getTime())) {
            throw new InvalidInventoryLedgerEntryException(
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
            props.sequence ?? null,
            props.movementType,
            props.source,
            quantityIn,
            quantityOut,
            unitCost,
            totalValue,
            balanceQuantity,
            balanceValue,
            balanceAverageCost,
            props.averageCostBefore,
            props.averageCostAfter,
            props.inventoryValueBefore,
            props.inventoryValueAfter,
            props.referenceType,
            props.referenceId,
            props.referenceDocument,
            occurredAt,
            new Date(),
        );
    }

    static rehydrate(
        props: InventoryLedgerEntryProps,
    ): InventoryLedgerEntry {
        InventoryLedgerEntry.validateIdentity(props);
        InventoryLedgerEntry.validateMovementType(props.movementType);
        InventoryLedgerEntry.validateSource(props.source);

        const currency = props.currency.trim().toUpperCase();

        const quantityRules: QuantityRules = {
            unitOfMeasureId: props.unitOfMeasureId,
            allowsFraction: props.allowsFraction,
            decimalPlaces: props.decimalPlaces,
        };

        const balanceQuantity = QuantityVO.create(
            props.balanceQuantity.getAmount(),
            quantityRules,
        );

        const balanceValue = MoneyVO.create(
            props.balanceValue.getAmount(),
            currency,
        );

        const balanceAverageCost = UnitCostVO.create(
            props.balanceAverageCost.getAmount(),
            currency,
        );

        const unitCost = UnitCostVO.create(
            props.unitCost.getAmount(),
            currency,
        );

        const totalValue = MoneyVO.create(
            props.totalValue.getAmount(),
            currency,
        );

        const quantityIn =
            props.quantityIn && props.quantityIn.isPositive()
                ? QuantityVO.create(props.quantityIn.getAmount(), quantityRules)
                : undefined;

        const quantityOut =
            props.quantityOut && props.quantityOut.isPositive()
                ? QuantityVO.create(props.quantityOut.getAmount(), quantityRules)
                : undefined;


        InventoryLedgerEntry.validateQuantities(quantityIn, quantityOut);
        InventoryLedgerEntry.validateBalance(balanceQuantity, balanceValue, balanceAverageCost, currency);
        InventoryLedgerEntry.validateTotalValue(quantityIn, quantityOut, unitCost, totalValue);

        if (Number.isNaN(props.occurredAt.getTime())) {
            throw new InvalidInventoryLedgerEntryException(
                'La fecha del Kardex no es válida',
            );
        }

        if (Number.isNaN(props.createdAt.getTime())) {
            throw new InvalidInventoryLedgerEntryException(
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
            props.sequence ?? null,
            props.movementType,
            props.source,
            quantityIn,
            quantityOut,
            unitCost,
            totalValue,
            balanceQuantity,
            balanceValue,
            balanceAverageCost,
            props.averageCostBefore,
            props.averageCostAfter,
            props.inventoryValueBefore,
            props.inventoryValueAfter,
            props.referenceType,
            props.referenceId,
            props.referenceDocument,
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

    getSequence(): bigint | null {
        return this.sequence;
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

    getQuantityDelta(): Decimal {
        if (this.quantityIn) {
            return this.quantityIn.getAmount();
        }
        if (this.quantityOut) {
            return this.quantityOut.getAmount().negated();
        }
        return new Decimal(0);
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

    getAverageCostBefore(): UnitCostVO | undefined {
        return this.averageCostBefore;
    }

    getAverageCostAfter(): UnitCostVO | undefined {
        return this.averageCostAfter;
    }

    getInventoryValueBefore(): MoneyVO | undefined {
        return this.inventoryValueBefore;
    }

    getInventoryValueAfter(): MoneyVO | undefined {
        return this.inventoryValueAfter;
    }

    getReferenceType(): ReferenceType | undefined {
        return this.referenceType;
    }

    getReferenceId(): string | undefined {
        return this.referenceId;
    }

    getReferenceDocument(): string | undefined {
        return this.referenceDocument;
    }

    getOccurredAt(): Date {
        return this.occurredAt;
    }

    getCreatedAt(): Date {
        return this.createdAt;
    }

    isInbound(): boolean {
        return this.quantityIn !== undefined && this.quantityIn.isPositive();
    }

    isOutbound(): boolean {
        return this.quantityOut !== undefined && this.quantityOut.isPositive();
    }


    private static validateIdentity(props: {
        id: string;
        tenantId: string;
        warehouseId: string;
        movementId: string;
        movementLineId: string;
        productId: string;
        variantId: string;
        unitOfMeasureId: string;
        allowsFraction: boolean;
        decimalPlaces: number;
    }): void {
        if (typeof props.id !== 'string' || !props.id.trim()) {
            throw new InvalidInventoryLedgerEntryException(
                'El identificador del Kardex es obligatorio',
            );
        }

        if (typeof props.tenantId !== 'string' || !props.tenantId.trim()) {
            throw new InvalidInventoryLedgerEntryException(
                'El Kardex debe pertenecer a un tenant',
            );
        }

        if (typeof props.warehouseId !== 'string' || !props.warehouseId.trim()) {
            throw new InvalidInventoryLedgerEntryException(
                'El Kardex debe pertenecer a una bodega',
            );
        }

        if (typeof props.movementId !== 'string' || !props.movementId.trim()) {
            throw new InvalidInventoryLedgerEntryException(
                'El Kardex debe pertenecer a un movimiento',
            );
        }

        if (typeof props.movementLineId !== 'string' || !props.movementLineId.trim()) {
            throw new InvalidInventoryLedgerEntryException(
                'El Kardex debe pertenecer a una línea de movimiento',
            );
        }

        if (typeof props.productId !== 'string' || !props.productId.trim()) {
            throw new InvalidInventoryLedgerEntryException(
                'El Kardex debe pertenecer a un producto',
            );
        }

        if (typeof props.variantId !== 'string' || !props.variantId.trim()) {
            throw new InvalidInventoryLedgerEntryException(
                'El Kardex debe pertenecer a una variante',
            );
        }

        if (typeof props.unitOfMeasureId !== 'string' || !props.unitOfMeasureId.trim()) {
            throw new InvalidInventoryLedgerEntryException(
                'El Kardex debe tener una unidad de medida',
            );
        }

        if (typeof props.allowsFraction !== 'boolean') {
            throw new InvalidInventoryLedgerEntryException(
                'La configuración de fraccionamiento de la unidad no es válida',
            );
        }

        if (
            !Number.isInteger(props.decimalPlaces) ||
            props.decimalPlaces < 0
        ) {
            throw new InvalidInventoryLedgerEntryException(
                'La precisión decimal de la unidad no es válida',
            );
        }

        if (!props.allowsFraction && props.decimalPlaces !== 0) {
            throw new InvalidInventoryLedgerEntryException(
                'Una unidad que no permite fracciones debe tener cero posiciones decimales',
            );
        }
    }

    private static validateMovementType(type: MovementType): void {
        if (!Object.values(MovementType).includes(type)) {
            throw new InvalidInventoryLedgerEntryException(
                'El tipo de movimiento del Kardex no es válido',
            );
        }
    }

    private static validateSource(source: MovementSource): void {
        if (!Object.values(MovementSource).includes(source)) {
            throw new InvalidInventoryLedgerEntryException(
                'El origen del Kardex no es válido',
            );
        }
    }

    private static validateQuantities(
        quantityIn: QuantityVO | undefined,
        quantityOut: QuantityVO | undefined,
    ): void {
        const hasInbound = quantityIn !== undefined && quantityIn.isPositive();
        const hasOutbound = quantityOut !== undefined && quantityOut.isPositive();

        if (hasInbound === hasOutbound) {
            throw new InvalidInventoryLedgerEntryException(
                'Una entrada del Kardex debe representar exactamente una entrada o una salida',
            );
        }

        const quantity = quantityIn ?? quantityOut;

        if (!quantity || !quantity.isPositive()) {
            throw new InvalidInventoryLedgerEntryException(
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
        if (balanceValue.getCurrency() !== currency) {
            throw new InvalidInventoryLedgerEntryException(
                'La moneda del valor del saldo no coincide con la moneda del Kardex',
            );
        }

        if (balanceAverageCost.getCurrency() !== currency) {
            throw new InvalidInventoryLedgerEntryException(
                'La moneda del costo promedio no coincide con la moneda del Kardex',
            );
        }

        if (balanceQuantity.isZero()) {
            if (!balanceValue.getAmount().isZero()) {
                throw new InvalidInventoryLedgerEntryException(
                    'Un saldo de cero no puede tener valor de inventario',
                );
            }

            if (!balanceAverageCost.getAmount().isZero()) {
                throw new InvalidInventoryLedgerEntryException(
                    'Un saldo de cero debe tener costo promedio cero',
                );
            }

            return;
        }

        // Validación precision-aware con tolerancia canónica derivada
        const expectedValue = InventoryPrecisionPolicy.roundInventoryValue(
            balanceAverageCost.getAmount().mul(balanceQuantity.getAmount()),
        );
        const tolerance = InventoryPrecisionPolicy.calculateValuationTolerance(
            balanceQuantity.getAmount(),
        );

        if (!InventoryPrecisionPolicy.areValuesEquivalent(expectedValue, balanceValue.getAmount(), tolerance)) {
            throw new InvalidInventoryLedgerEntryException(
                'El valor del saldo no coincide razonablemente con la cantidad multiplicada por el costo promedio',
            );
        }
    }

    private static validateTotalValue(
        quantityIn: QuantityVO | undefined,
        quantityOut: QuantityVO | undefined,
        unitCost: UnitCostVO,
        totalValue: MoneyVO,
    ): void {
        const quantity = quantityIn ?? quantityOut;

        if (!quantity) {
            throw new InvalidInventoryLedgerEntryException(
                'El Kardex debe tener una cantidad',
            );
        }

        if (totalValue.getCurrency() !== unitCost.getCurrency()) {
            throw new InvalidInventoryLedgerEntryException(
                'La moneda del valor total no coincide con la moneda del costo unitario',
            );
        }

        const expectedTotal = unitCost.multiply(quantity.getAmount());

        if (!InventoryPrecisionPolicy.areValuesEquivalent(expectedTotal, totalValue.getAmount())) {
            throw new InvalidInventoryLedgerEntryException(
                'El valor total del Kardex no coincide razonablemente con la cantidad multiplicada por el costo unitario',
            );
        }
    }
}