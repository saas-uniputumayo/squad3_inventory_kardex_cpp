import Decimal from 'decimal.js';

import { InvalidInventoryBalanceException } from '../../exceptions/invalid-inventory-balance.exception';
import { MoneyVO } from '../../value-objects/money.vo';
import {
    QuantityRules,
    QuantityVO,
} from '../../value-objects/quantity.vo';
import { UnitCostVO } from '../../value-objects/unit-cost.vo';

export interface CreateInventoryBalanceProps {
    id: string;
    tenantId: string;
    warehouseId: string;
    productId: string;
    variantId?: string;
    unitOfMeasureId: string;
    allowsFraction: boolean;
    decimalPlaces: number;
    currency?: string;
    quantityOnHand?: Decimal.Value;
    reservedQuantity?: Decimal.Value;
    averageCost?: Decimal.Value;
    inventoryValue?: Decimal.Value;
    version?: number;
}

export interface InventoryBalanceProps {
    id: string;
    tenantId: string;
    warehouseId: string;
    productId: string;
    variantId?: string;
    unitOfMeasureId: string;
    allowsFraction: boolean;
    decimalPlaces: number;
    currency: string;
    quantityOnHand: QuantityVO;
    reservedQuantity: QuantityVO;
    averageCost: UnitCostVO;
    inventoryValue: MoneyVO;
    version: number;
    createdAt: Date;
    updatedAt: Date;
}

export class InventoryBalance {
    private constructor(
        private readonly id: string,
        private readonly tenantId: string,
        private readonly warehouseId: string,
        private readonly productId: string,
        private readonly variantId: string | undefined,
        private readonly unitOfMeasureId: string,
        private readonly allowsFraction: boolean,
        private readonly decimalPlaces: number,
        private readonly currency: string,
        private quantityOnHand: QuantityVO,
        private reservedQuantity: QuantityVO,
        private averageCost: UnitCostVO,
        private inventoryValue: MoneyVO,
        private version: number,
        private readonly createdAt: Date,
        private updatedAt: Date,
    ) { }

    static create(
        props: CreateInventoryBalanceProps,
    ): InventoryBalance {
        InventoryBalance.validateIdentity(props);

        const currency =
            props.currency?.trim().toUpperCase() ?? 'COP';

        const quantityRules: QuantityRules = {
            unitOfMeasureId: props.unitOfMeasureId,
            allowsFraction: props.allowsFraction,
            decimalPlaces: props.decimalPlaces,
        };

        const quantityOnHand = QuantityVO.create(
            props.quantityOnHand ?? 0,
            quantityRules,
        );

        const reservedQuantity = QuantityVO.create(
            props.reservedQuantity ?? 0,
            quantityRules,
        );

        const averageCost = UnitCostVO.create(
            props.averageCost ?? 0,
            currency,
        );

        const inventoryValue = MoneyVO.create(
            props.inventoryValue ?? 0,
            currency,
        );

        const version = props.version ?? 0;

        if (version < 0 || !Number.isInteger(version)) {
            throw new InvalidInventoryBalanceException(
                'La versión del inventario debe ser un entero no negativo',
            );
        }

        const now = new Date();

        const balance = new InventoryBalance(
            props.id,
            props.tenantId,
            props.warehouseId,
            props.productId,
            props.variantId,
            props.unitOfMeasureId,
            props.allowsFraction,
            props.decimalPlaces,
            currency,
            quantityOnHand,
            reservedQuantity,
            averageCost,
            inventoryValue,
            version,
            now,
            now,
        );

        balance.validateState();

        return balance;
    }

    static rehydrate(
        props: InventoryBalanceProps,
    ): InventoryBalance {
        InventoryBalance.validateIdentity(props);

        const quantityRules: QuantityRules = {
            unitOfMeasureId: props.unitOfMeasureId,
            allowsFraction: props.allowsFraction,
            decimalPlaces: props.decimalPlaces,
        };

        const quantityOnHand = QuantityVO.create(
            props.quantityOnHand.getAmount(),
            quantityRules,
        );

        const reservedQuantity = QuantityVO.create(
            props.reservedQuantity.getAmount(),
            quantityRules,
        );

        const averageCost = UnitCostVO.create(
            props.averageCost.getAmount(),
            props.currency,
        );

        const inventoryValue = MoneyVO.create(
            props.inventoryValue.getAmount(),
            props.currency,
        );

        if (
            props.version < 0 ||
            !Number.isInteger(props.version)
        ) {
            throw new InvalidInventoryBalanceException(
                'La versión del inventario debe ser un entero no negativo',
            );
        }

        const balance = new InventoryBalance(
            props.id,
            props.tenantId,
            props.warehouseId,
            props.productId,
            props.variantId,
            props.unitOfMeasureId,
            props.allowsFraction,
            props.decimalPlaces,
            props.currency.trim().toUpperCase(),
            quantityOnHand,
            reservedQuantity,
            averageCost,
            inventoryValue,
            props.version,
            props.createdAt,
            props.updatedAt,
        );

        balance.validateState();

        return balance;
    }

    /**
     * Registra una entrada de inventario y recalcula
     * el costo promedio ponderado (CPP).
     *
     * Fórmula:
     *
     * nuevo CPP =
     * (
     *   valor inventario actual
     *   +
     *   valor entrada
     * )
     * /
     * (
     *   cantidad actual
     *   +
     *   cantidad entrada
     * )
     */
    receive(
        quantity: QuantityVO,
        unitCost: UnitCostVO,
    ): void {
        this.ensureSameUnit(quantity);
        this.ensureSameCurrency(unitCost);

        if (!quantity.isPositive()) {
            throw new InvalidInventoryBalanceException(
                'La cantidad recibida debe ser mayor que cero',
            );
        }

        const currentQuantity =
            this.quantityOnHand.getAmount();

        const receivedQuantity =
            quantity.getAmount();

        const currentInventoryValue =
            this.inventoryValue.getAmount();

        const receivedInventoryValue =
            unitCost.multiply(receivedQuantity);

        const newQuantity =
            currentQuantity.plus(receivedQuantity);

        const newInventoryValue =
            currentInventoryValue.plus(
                receivedInventoryValue,
            );

        const newAverageCost =
            newInventoryValue.div(newQuantity);

        this.quantityOnHand =
            this.createQuantity(newQuantity);

        this.inventoryValue =
            MoneyVO.create(
                newInventoryValue,
                this.currency,
            );

        this.averageCost =
            UnitCostVO.create(
                newAverageCost,
                this.currency,
            );

        this.touch();
        this.incrementVersion();

        this.validateState();
    }

    /**
     * Registra una salida de inventario.
     *
     * El costo de la salida utiliza el CPP vigente.
     * La salida NO modifica el CPP.
     *
     * Retorna el valor total del costo de inventario
     * consumido por la salida.
     */
    dispatch(
        quantity: QuantityVO,
    ): MoneyVO {
        this.ensureSameUnit(quantity);

        if (!quantity.isPositive()) {
            throw new InvalidInventoryBalanceException(
                'La cantidad despachada debe ser mayor que cero',
            );
        }

        if (!this.hasStock(quantity)) {
            throw new InvalidInventoryBalanceException(
                'No hay existencias suficientes para realizar el despacho',
            );
        }

        const dispatchQuantity =
            quantity.getAmount();

        const dispatchValue =
            this.averageCost.multiply(
                dispatchQuantity,
            );

        const newQuantity =
            this.quantityOnHand
                .getAmount()
                .minus(dispatchQuantity);

        const newInventoryValue =
            this.inventoryValue
                .getAmount()
                .minus(dispatchValue);

        this.quantityOnHand =
            this.createQuantity(newQuantity);

        if (newQuantity.isZero()) {
            this.inventoryValue =
                MoneyVO.create(
                    0,
                    this.currency,
                );
        } else {
            this.inventoryValue =
                MoneyVO.create(
                    newInventoryValue,
                    this.currency,
                );
        }

        this.touch();
        this.incrementVersion();

        this.validateState();

        return MoneyVO.create(
            dispatchValue,
            this.currency,
        );
    }

    /**
     * Reserva existencias disponibles.
     */
    reserve(
        quantity: QuantityVO,
    ): void {
        this.ensureSameUnit(quantity);

        if (!quantity.isPositive()) {
            throw new InvalidInventoryBalanceException(
                'La cantidad a reservar debe ser mayor que cero',
            );
        }

        if (!this.hasStock(quantity)) {
            throw new InvalidInventoryBalanceException(
                'No hay existencias disponibles suficientes para realizar la reserva',
            );
        }

        const newReservedQuantity =
            this.reservedQuantity.add(quantity);

        this.reservedQuantity =
            newReservedQuantity;

        this.touch();
        this.incrementVersion();

        this.validateState();
    }

    /**
     * Libera una reserva existente.
     */
    releaseReservation(
        quantity: QuantityVO,
    ): void {
        this.ensureSameUnit(quantity);

        if (!quantity.isPositive()) {
            throw new InvalidInventoryBalanceException(
                'La cantidad a liberar debe ser mayor que cero',
            );
        }

        if (
            quantity.isGreaterThan(
                this.reservedQuantity,
            )
        ) {
            throw new InvalidInventoryBalanceException(
                'La cantidad a liberar no puede superar la cantidad reservada',
            );
        }

        this.reservedQuantity =
            this.reservedQuantity.subtract(
                quantity,
            );

        this.touch();
        this.incrementVersion();

        this.validateState();
    }

    /**
     * Ajusta directamente la existencia física
     * y el valor total del inventario.
     *
     * Este método está pensado para ajustes de inventario,
     * conteos físicos y mermas.
     *
     * El nuevo CPP se calcula como:
     *
     * nuevo CPP = nuevo valor / nueva cantidad
     */
    adjust(
        newQuantity: QuantityVO,
        newInventoryValue: MoneyVO,
    ): void {
        this.ensureSameUnit(newQuantity);
        this.ensureSameCurrency(
            newInventoryValue,
        );

        const quantity =
            newQuantity.getAmount();

        const value =
            newInventoryValue.getAmount();

        if (
            quantity.isZero() &&
            !value.isZero()
        ) {
            throw new InvalidInventoryBalanceException(
                'Una existencia de cero no puede tener valor de inventario',
            );
        }

        if (
            newQuantity.isLessThan(
                this.reservedQuantity,
            )
        ) {
            throw new InvalidInventoryBalanceException(
                'La existencia ajustada no puede ser menor que la cantidad reservada',
            );
        }

        let newAverageCost =
            UnitCostVO.create(
                0,
                this.currency,
            );

        if (!quantity.isZero()) {
            newAverageCost =
                UnitCostVO.create(
                    value.div(quantity),
                    this.currency,
                );
        }

        this.quantityOnHand =
            newQuantity;

        this.inventoryValue =
            newInventoryValue;

        this.averageCost =
            newAverageCost;

        this.touch();
        this.incrementVersion();

        this.validateState();
    }

    /**
     * Indica si existe suficiente stock disponible.
     *
     * Disponible = existencia física - reservado.
     */
    hasStock(
        quantity: QuantityVO,
    ): boolean {
        this.ensureSameUnit(quantity);

        return quantity.isLessThanOrEqual(
            this.getAvailableQuantity(),
        );
    }

    getAvailableQuantity(): QuantityVO {
        return this.quantityOnHand.subtract(
            this.reservedQuantity,
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

    getQuantityOnHand(): QuantityVO {
        return this.quantityOnHand;
    }

    getReservedQuantity(): QuantityVO {
        return this.reservedQuantity;
    }

    getAvailableStock(): QuantityVO {
        return this.getAvailableQuantity();
    }

    getAverageCost(): UnitCostVO {
        return this.averageCost;
    }

    getInventoryValue(): MoneyVO {
        return this.inventoryValue;
    }

    getVersion(): number {
        return this.version;
    }

    getCreatedAt(): Date {
        return this.createdAt;
    }

    getUpdatedAt(): Date {
        return this.updatedAt;
    }

    private createQuantity(
        amount: Decimal.Value,
    ): QuantityVO {
        return QuantityVO.create(
            amount,
            this.getQuantityRules(),
        );
    }

    private getQuantityRules(): QuantityRules {
        return {
            unitOfMeasureId:
                this.unitOfMeasureId,
            allowsFraction:
                this.allowsFraction,
            decimalPlaces:
                this.decimalPlaces,
        };
    }

    private ensureSameUnit(
        quantity: QuantityVO,
    ): void {
        if (
            quantity.getUnitOfMeasureId() !==
            this.unitOfMeasureId
        ) {
            throw new InvalidInventoryBalanceException(
                'La cantidad utiliza una unidad de medida diferente a la del inventario',
            );
        }

        if (
            quantity.getAllowsFraction() !==
            this.allowsFraction
        ) {
            throw new InvalidInventoryBalanceException(
                'La cantidad utiliza una configuración de fraccionamiento diferente a la del inventario',
            );
        }

        if (
            quantity.getDecimalPlaces() !==
            this.decimalPlaces
        ) {
            throw new InvalidInventoryBalanceException(
                'La cantidad utiliza una precisión decimal diferente a la del inventario',
            );
        }
    }

    private ensureSameCurrency(
        value: UnitCostVO | MoneyVO,
    ): void {
        if (
            value.getCurrency() !==
            this.currency
        ) {
            throw new InvalidInventoryBalanceException(
                'La moneda no coincide con la moneda del inventario',
            );
        }
    }

    private validateState(): void {
        if (
            this.quantityOnHand.getUnitOfMeasureId() !==
            this.unitOfMeasureId
        ) {
            throw new InvalidInventoryBalanceException(
                'La unidad de medida de la existencia no coincide con la del inventario',
            );
        }

        if (
            this.reservedQuantity.getUnitOfMeasureId() !==
            this.unitOfMeasureId
        ) {
            throw new InvalidInventoryBalanceException(
                'La unidad de medida de la reserva no coincide con la del inventario',
            );
        }

        if (
            this.quantityOnHand.getAllowsFraction() !==
            this.allowsFraction ||
            this.reservedQuantity.getAllowsFraction() !==
            this.allowsFraction
        ) {
            throw new InvalidInventoryBalanceException(
                'Las reglas de fraccionamiento de las cantidades no coinciden con las del inventario',
            );
        }

        if (
            this.quantityOnHand.getDecimalPlaces() !==
            this.decimalPlaces ||
            this.reservedQuantity.getDecimalPlaces() !==
            this.decimalPlaces
        ) {
            throw new InvalidInventoryBalanceException(
                'La precisión decimal de las cantidades no coincide con la del inventario',
            );
        }

        if (
            this.reservedQuantity.isGreaterThan(
                this.quantityOnHand,
            )
        ) {
            throw new InvalidInventoryBalanceException(
                'La cantidad reservada no puede superar la existencia física',
            );
        }

        this.ensureSameCurrency(
            this.averageCost,
        );

        this.ensureSameCurrency(
            this.inventoryValue,
        );

        const quantity =
            this.quantityOnHand.getAmount();

        const inventoryValue =
            this.inventoryValue.getAmount();

        const averageCost =
            this.averageCost.getAmount();

        if (
            quantity.isZero() &&
            !inventoryValue.isZero()
        ) {
            throw new InvalidInventoryBalanceException(
                'Una existencia de cero no puede tener valor de inventario',
            );
        }

        if (
            quantity.isZero() &&
            !averageCost.isZero()
        ) {
            throw new InvalidInventoryBalanceException(
                'Una existencia de cero debe tener costo promedio cero',
            );
        }

        if (!quantity.isZero()) {
            const expectedValue =
                averageCost.mul(quantity);

            if (
                !expectedValue.eq(
                    inventoryValue,
                )
            ) {
                throw new InvalidInventoryBalanceException(
                    'El valor del inventario no coincide con la cantidad multiplicada por el costo promedio',
                );
            }
        }
    }

    private static validateIdentity(
        props: {
            id: string;
            tenantId: string;
            warehouseId: string;
            productId: string;
            unitOfMeasureId: string;
            allowsFraction: boolean;
            decimalPlaces: number;
        },
    ): void {
        if (!props.id.trim()) {
            throw new InvalidInventoryBalanceException(
                'El identificador del inventario es obligatorio',
            );
        }

        if (!props.tenantId.trim()) {
            throw new InvalidInventoryBalanceException(
                'El inventario debe pertenecer a un tenant',
            );
        }

        if (!props.warehouseId.trim()) {
            throw new InvalidInventoryBalanceException(
                'El inventario debe pertenecer a una bodega',
            );
        }

        if (!props.productId.trim()) {
            throw new InvalidInventoryBalanceException(
                'El inventario debe pertenecer a un producto',
            );
        }

        if (!props.unitOfMeasureId.trim()) {
            throw new InvalidInventoryBalanceException(
                'El inventario debe tener una unidad de medida',
            );
        }

        if (
            typeof props.allowsFraction !==
            'boolean'
        ) {
            throw new InvalidInventoryBalanceException(
                'La configuración de fraccionamiento de la unidad no es válida',
            );
        }

        if (
            !Number.isInteger(
                props.decimalPlaces,
            ) ||
            props.decimalPlaces < 0
        ) {
            throw new InvalidInventoryBalanceException(
                'La precisión decimal de la unidad no es válida',
            );
        }

        if (
            !props.allowsFraction &&
            props.decimalPlaces !== 0
        ) {
            throw new InvalidInventoryBalanceException(
                'Una unidad que no permite fracciones debe tener cero posiciones decimales',
            );
        }
    }

    private touch(): void {
        this.updatedAt = new Date();
    }

    private incrementVersion(): void {
        this.version += 1;
    }
}