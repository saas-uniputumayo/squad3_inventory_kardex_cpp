import Decimal from 'decimal.js';

import { InvalidInventoryBalanceException } from '../../exceptions/invalid-inventory-balance.exception';
import { MoneyVO } from '../../value-objects/money.vo';
import {
    QuantityRules,
    QuantityVO,
} from '../../value-objects/quantity.vo';
import { UnitCostVO } from '../../value-objects/unit-cost.vo';
import { InventoryPrecisionPolicy } from '../../policy/precision.policy';

export interface CreateInventoryBalanceProps {
    id: string;
    tenantId: string;
    warehouseId: string;
    productId: string;
    variantId: string;
    unitOfMeasureId: string;
    allowsFraction: boolean;
    decimalPlaces: number;
    currency?: string;
    quantityOnHand?: Decimal.Value;
    reservedQuantity?: Decimal.Value;
    averageCost?: Decimal.Value;
    inventoryValue?: Decimal.Value;
    version?: number | bigint;
}

export interface InventoryBalanceProps {
    id: string;
    tenantId: string;
    warehouseId: string;
    productId: string;
    variantId: string;
    unitOfMeasureId: string;
    allowsFraction: boolean;
    decimalPlaces: number;
    currency: string;
    quantityOnHand: QuantityVO;
    reservedQuantity: QuantityVO;
    averageCost: UnitCostVO;
    inventoryValue: MoneyVO;
    version: number | bigint;
    createdAt: Date;
    updatedAt: Date;
}

export class InventoryBalance {
    private constructor(
        private readonly id: string,
        private readonly tenantId: string,
        private readonly warehouseId: string,
        private readonly productId: string,
        private readonly variantId: string,
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

        const versionNum = props.version !== undefined ? Number(props.version) : 0;

        if (versionNum < 0 || !Number.isInteger(versionNum)) {
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
            versionNum,
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

        const currency = props.currency.trim().toUpperCase();

        const averageCost = UnitCostVO.create(
            props.averageCost.getAmount(),
            currency,
        );

        const inventoryValue = MoneyVO.create(
            props.inventoryValue.getAmount(),
            currency,
        );

        const versionNum = Number(props.version);

        if (versionNum < 0 || !Number.isInteger(versionNum)) {
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
            currency,
            quantityOnHand,
            reservedQuantity,
            averageCost,
            inventoryValue,
            versionNum,
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
     * Fórmula canónica:
     * valorRecibido = round(cantidadRecibida × costoUnitario, 4)
     * nuevoValor = round(valorExistente + valorRecibido, 4)
     * nuevaCantidad = cantidadExistente + cantidadRecibida
     * nuevoCPP = round(nuevoValor / nuevaCantidad, 6)
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

        const currentQuantity = this.quantityOnHand.getAmount();
        const receivedQuantity = quantity.getAmount();
        const currentInventoryValue = this.inventoryValue.getAmount();
        const receivedUnitCost = unitCost.getAmount();

        // valorRecibido = round(cantidadRecibida × costoUnitario, 4)
        const valorRecibido = InventoryPrecisionPolicy.roundInventoryValue(
            receivedQuantity.mul(receivedUnitCost),
        );

        // nuevoValor = round(valorExistente + valorRecibido, 4)
        const nuevoValor = InventoryPrecisionPolicy.roundInventoryValue(
            currentInventoryValue.plus(valorRecibido),
        );

        // nuevaCantidad = cantidadExistente + cantidadRecibida
        const nuevaCantidad = currentQuantity.plus(receivedQuantity);

        // nuevoCPP = round(nuevoValor / nuevaCantidad, 6)
        const nuevoCPP = InventoryPrecisionPolicy.roundUnitCost(
            nuevoValor.div(nuevaCantidad),
        );

        this.quantityOnHand = this.createQuantity(nuevaCantidad);
        this.inventoryValue = MoneyVO.create(nuevoValor, this.currency);
        this.averageCost = UnitCostVO.create(nuevoCPP, this.currency);

        this.touch();
        this.incrementVersion();

        this.validateState();
    }

    /**
     * Registra una salida de inventario.
     *
     * El costo de salida utiliza el CPP actual:
     * valorSalida = round(cantidadSalida × CPP, 4)
     * nuevoValor = round(valorExistente - valorSalida, 4)
     * nuevaCantidad = cantidadExistente - cantidadSalida
     *
     * El CPP permanece igual mientras haya existencia.
     * Si la existencia llega exactamente a cero:
     * quantity = 0, inventoryValue = 0, averageCost = 0.
     *
     * Retorna el valor total del costo de inventario consumido por la salida.
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

        const dispatchQuantity = quantity.getAmount();
        const currentCPP = this.averageCost.getAmount();

        // valorSalida = round(cantidadSalida × CPP, 4)
        const dispatchValueAmount = InventoryPrecisionPolicy.roundInventoryValue(
            dispatchQuantity.mul(currentCPP),
        );

        const newQuantity = this.quantityOnHand.getAmount().minus(dispatchQuantity);

        if (newQuantity.isZero()) {
            this.quantityOnHand = this.createQuantity(0);
            this.inventoryValue = MoneyVO.create(0, this.currency);
            this.averageCost = UnitCostVO.create(0, this.currency);
        } else {
            // nuevoValor = round(valorExistente - valorSalida, 4)
            let newInventoryValue = InventoryPrecisionPolicy.roundInventoryValue(
                this.inventoryValue.getAmount().minus(dispatchValueAmount),
            );

            if (newInventoryValue.isNegative()) {
                newInventoryValue = new Decimal(0);
            }

            this.quantityOnHand = this.createQuantity(newQuantity);
            this.inventoryValue = MoneyVO.create(newInventoryValue, this.currency);
            // El CPP permanece igual mientras aún haya existencia
        }

        this.touch();
        this.incrementVersion();

        this.validateState();

        return MoneyVO.create(dispatchValueAmount, this.currency);
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

        const newReservedQuantity = this.reservedQuantity.add(quantity);

        this.reservedQuantity = newReservedQuantity;

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

        if (quantity.isGreaterThan(this.reservedQuantity)) {
            throw new InvalidInventoryBalanceException(
                'La cantidad a liberar no puede superar la cantidad reservada',
            );
        }

        this.reservedQuantity = this.reservedQuantity.subtract(quantity);

        this.touch();
        this.incrementVersion();

        this.validateState();
    }

    release(quantity: QuantityVO): void {
        this.releaseReservation(quantity);
    }

    /**
     * Ajusta directamente la existencia física y el valor total del inventario.
     *
     * Utilizado para ajustes de inventario, conteos físicos y mermas.
     * Si quantity > 0:
     *   CPP = round(inventoryValue / quantity, 6)
     * Si quantity = 0:
     *   inventoryValue = 0
     *   averageCost = 0
     */
    adjust(
        newQuantity: QuantityVO,
        newInventoryValue: MoneyVO,
    ): void {
        this.ensureSameUnit(newQuantity);
        this.ensureSameCurrency(newInventoryValue);

        const quantity = newQuantity.getAmount();
        const value = InventoryPrecisionPolicy.roundInventoryValue(
            newInventoryValue.getAmount(),
        );

        if (quantity.isZero() && !value.isZero()) {
            throw new InvalidInventoryBalanceException(
                'Una existencia de cero no puede tener valor de inventario',
            );
        }

        if (newQuantity.isLessThan(this.reservedQuantity)) {
            throw new InvalidInventoryBalanceException(
                'La existencia ajustada no puede ser menor que la cantidad reservada',
            );
        }

        let newAverageCost: Decimal;

        if (quantity.isZero()) {
            newAverageCost = new Decimal(0);
        } else {
            newAverageCost = InventoryPrecisionPolicy.roundUnitCost(
                value.div(quantity),
            );
        }

        this.quantityOnHand = newQuantity;
        this.inventoryValue = MoneyVO.create(value, this.currency);
        this.averageCost = UnitCostVO.create(newAverageCost, this.currency);

        this.touch();
        this.incrementVersion();

        this.validateState();
    }

    /**
     * Indica si existe suficiente stock disponible.
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

    getQuantityOnHand(): QuantityVO {
        return this.quantityOnHand;
    }

    getQuantity(): QuantityVO {
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
            unitOfMeasureId: this.unitOfMeasureId,
            allowsFraction: this.allowsFraction,
            decimalPlaces: this.decimalPlaces,
        };
    }

    private ensureSameUnit(
        quantity: QuantityVO,
    ): void {
        if (!quantity) {
            throw new InvalidInventoryBalanceException(
                'La cantidad es obligatoria',
            );
        }

        if (quantity.getUnitOfMeasureId() !== this.unitOfMeasureId) {
            throw new InvalidInventoryBalanceException(
                'La cantidad utiliza una unidad de medida diferente a la del inventario',
            );
        }

        if (quantity.getAllowsFraction() !== this.allowsFraction) {
            throw new InvalidInventoryBalanceException(
                'La cantidad utiliza una configuración de fraccionamiento diferente a la del inventario',
            );
        }

        if (quantity.getDecimalPlaces() !== this.decimalPlaces) {
            throw new InvalidInventoryBalanceException(
                'La cantidad utiliza una precisión decimal diferente a la del inventario',
            );
        }
    }

    private ensureSameCurrency(
        value: UnitCostVO | MoneyVO,
    ): void {
        if (!value) {
            throw new InvalidInventoryBalanceException(
                'El valor monetario es obligatorio',
            );
        }

        if (value.getCurrency() !== this.currency) {
            throw new InvalidInventoryBalanceException(
                'La moneda no coincide con la moneda del inventario',
            );
        }
    }

    private validateState(): void {
        if (this.quantityOnHand.getUnitOfMeasureId() !== this.unitOfMeasureId) {
            throw new InvalidInventoryBalanceException(
                'La unidad de medida de la existencia no coincide con la del inventario',
            );
        }

        if (this.reservedQuantity.getUnitOfMeasureId() !== this.unitOfMeasureId) {
            throw new InvalidInventoryBalanceException(
                'La unidad de medida de la reserva no coincide con la del inventario',
            );
        }

        if (
            this.quantityOnHand.getAllowsFraction() !== this.allowsFraction ||
            this.reservedQuantity.getAllowsFraction() !== this.allowsFraction
        ) {
            throw new InvalidInventoryBalanceException(
                'Las reglas de fraccionamiento de las cantidades no coinciden con las del inventario',
            );
        }

        if (
            this.quantityOnHand.getDecimalPlaces() !== this.decimalPlaces ||
            this.reservedQuantity.getDecimalPlaces() !== this.decimalPlaces
        ) {
            throw new InvalidInventoryBalanceException(
                'La precisión decimal de las cantidades no coincide con la del inventario',
            );
        }

        if (this.reservedQuantity.isGreaterThan(this.quantityOnHand)) {
            throw new InvalidInventoryBalanceException(
                'La cantidad reservada no puede superar la existencia física',
            );
        }

        this.ensureSameCurrency(this.averageCost);
        this.ensureSameCurrency(this.inventoryValue);

        const quantity = this.quantityOnHand.getAmount();
        const inventoryValue = this.inventoryValue.getAmount();
        const averageCost = this.averageCost.getAmount();

        if (quantity.isZero()) {
            if (!inventoryValue.isZero()) {
                throw new InvalidInventoryBalanceException(
                    'Una existencia de cero no puede tener valor de inventario',
                );
            }

            if (!averageCost.isZero()) {
                throw new InvalidInventoryBalanceException(
                    'Una existencia de cero debe tener costo promedio cero',
                );
            }
            // Validación con tolerancia canónica derivada para prevenir falsos positivos o rechazos por redondeo
            const expectedValue = InventoryPrecisionPolicy.roundInventoryValue(
                averageCost.mul(quantity),
            );
            const tolerance = InventoryPrecisionPolicy.calculateValuationTolerance(quantity);

            if (!InventoryPrecisionPolicy.areValuesEquivalent(expectedValue, inventoryValue, tolerance)) {
                throw new InvalidInventoryBalanceException(
                    `El valor del inventario (${inventoryValue.toFixed(4)}) no coincide con la cantidad (${quantity}) multiplicada por el costo promedio (${averageCost.toFixed(6)})`,
                );
            }
        }
    }

    private static validateIdentity(props: {
        id: string;
        tenantId: string;
        warehouseId: string;
        productId: string;
        variantId: string;
        unitOfMeasureId: string;
        allowsFraction: boolean;
        decimalPlaces: number;
    }): void {
        if (typeof props.id !== 'string' || !props.id.trim()) {
            throw new InvalidInventoryBalanceException(
                'El identificador del inventario es obligatorio',
            );
        }

        if (typeof props.tenantId !== 'string' || !props.tenantId.trim()) {
            throw new InvalidInventoryBalanceException(
                'El inventario debe pertenecer a un tenant',
            );
        }

        if (typeof props.warehouseId !== 'string' || !props.warehouseId.trim()) {
            throw new InvalidInventoryBalanceException(
                'El inventario debe pertenecer a una bodega',
            );
        }

        if (typeof props.productId !== 'string' || !props.productId.trim()) {
            throw new InvalidInventoryBalanceException(
                'El inventario debe pertenecer a un producto',
            );
        }

        if (typeof props.variantId !== 'string' || !props.variantId.trim()) {
            throw new InvalidInventoryBalanceException(
                'El inventario debe estar asociado a una variante de producto',
            );
        }

        if (typeof props.unitOfMeasureId !== 'string' || !props.unitOfMeasureId.trim()) {
            throw new InvalidInventoryBalanceException(
                'El inventario debe tener una unidad de medida',
            );
        }

        if (typeof props.allowsFraction !== 'boolean') {
            throw new InvalidInventoryBalanceException(
                'La configuración de fraccionamiento de la unidad no es válida',
            );
        }

        if (
            !Number.isInteger(props.decimalPlaces) ||
            props.decimalPlaces < 0
        ) {
            throw new InvalidInventoryBalanceException(
                'La precisión decimal de la unidad no es válida',
            );
        }

        if (!props.allowsFraction && props.decimalPlaces !== 0) {
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