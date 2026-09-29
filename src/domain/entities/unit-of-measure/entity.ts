import Decimal from 'decimal.js';
import { InvalidUnitOfMeasureException } from '../../exceptions/invalid-unit-of-measure.exception';
import { UnitOfMeasureCodeVO } from '../../value-objects/unit-of-measure-code.vo';

export enum UnitType {
    UNIT = 'UNIT',
    WEIGHT = 'WEIGHT',
    LENGTH = 'LENGTH',
    VOLUME = 'VOLUME',
}

export enum UnitOfMeasureStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
}

export interface CreateUnitOfMeasureProps {
    id: string;
    tenantId: string;
    code: UnitOfMeasureCodeVO;
    name: string;
    type: UnitType;
    allowsFraction?: boolean;
    decimalPlaces?: number;
}

export interface UnitOfMeasureProps {
    id: string;
    tenantId: string;
    code: UnitOfMeasureCodeVO;
    name: string;
    type: UnitType;
    allowsFraction: boolean;
    decimalPlaces: number;
    status: UnitOfMeasureStatus;
    createdAt: Date;
    updatedAt: Date;
}

export class UnitOfMeasure {
    private static readonly MAX_NAME_LENGTH = 100;
    private static readonly MIN_DECIMAL_PLACES = 0;
    private static readonly MAX_DECIMAL_PLACES = 6;

    private constructor(
        private readonly id: string,
        private readonly tenantId: string,
        private code: UnitOfMeasureCodeVO,
        private name: string,
        private type: UnitType,
        private allowsFraction: boolean,
        private decimalPlaces: number,
        private status: UnitOfMeasureStatus,
        private readonly createdAt: Date,
        private updatedAt: Date,
    ) { }

    static create(
        props: CreateUnitOfMeasureProps,
    ): UnitOfMeasure {
        UnitOfMeasure.validateIdentity(props);

        const name = props.name.trim();

        if (!name) {
            throw new InvalidUnitOfMeasureException(
                'El nombre de la unidad de medida es obligatorio',
            );
        }

        if (name.length > UnitOfMeasure.MAX_NAME_LENGTH) {
            throw new InvalidUnitOfMeasureException(
                `El nombre de la unidad de medida no puede superar los ${UnitOfMeasure.MAX_NAME_LENGTH} caracteres`,
            );
        }

        UnitOfMeasure.validateType(props.type);

        const allowsFraction = props.allowsFraction ?? true;
        const decimalPlaces = props.decimalPlaces ?? 3; // Coincide con prisma default decimal_places: 3

        UnitOfMeasure.validateDecimalPlaces(decimalPlaces);

        if (!allowsFraction && decimalPlaces !== 0) {
            throw new InvalidUnitOfMeasureException(
                'Una unidad que no permite fracciones debe tener cero posiciones decimales',
            );
        }

        const now = new Date();

        return new UnitOfMeasure(
            props.id,
            props.tenantId,
            props.code,
            name,
            props.type,
            allowsFraction,
            decimalPlaces,
            UnitOfMeasureStatus.ACTIVE,
            now,
            now,
        );
    }

    static rehydrate(
        props: UnitOfMeasureProps,
    ): UnitOfMeasure {
        UnitOfMeasure.validateIdentity(props);

        if (!props.name.trim()) {
            throw new InvalidUnitOfMeasureException(
                'El nombre de la unidad de medida es obligatorio',
            );
        }

        UnitOfMeasure.validateType(props.type);
        UnitOfMeasure.validateDecimalPlaces(props.decimalPlaces);

        if (!props.allowsFraction && props.decimalPlaces !== 0) {
            throw new InvalidUnitOfMeasureException(
                'Una unidad que no permite fracciones debe tener cero posiciones decimales',
            );
        }

        return new UnitOfMeasure(
            props.id,
            props.tenantId,
            props.code,
            props.name.trim(),
            props.type,
            props.allowsFraction,
            props.decimalPlaces,
            props.status,
            props.createdAt,
            props.updatedAt,
        );
    }

    updateDetails(props: {
        code?: UnitOfMeasureCodeVO;
        name?: string;
        type?: UnitType;
        allowsFraction?: boolean;
        decimalPlaces?: number;
    }): void {
        this.ensureActive();

        if (props.code !== undefined) {
            this.code = props.code;
        }

        if (props.name !== undefined) {
            const name = props.name.trim();

            if (!name) {
                throw new InvalidUnitOfMeasureException(
                    'El nombre de la unidad de medida es obligatorio',
                );
            }

            if (name.length > UnitOfMeasure.MAX_NAME_LENGTH) {
                throw new InvalidUnitOfMeasureException(
                    `El nombre de la unidad de medida no puede superar los ${UnitOfMeasure.MAX_NAME_LENGTH} caracteres`,
                );
            }

            this.name = name;
        }

        if (props.type !== undefined) {
            UnitOfMeasure.validateType(props.type);
            this.type = props.type;
        }

        if (props.allowsFraction !== undefined) {
            this.allowsFraction = props.allowsFraction;
        }

        if (props.decimalPlaces !== undefined) {
            UnitOfMeasure.validateDecimalPlaces(props.decimalPlaces);
            this.decimalPlaces = props.decimalPlaces;
        }

        this.validateFractionConfiguration();
        this.touch();
    }

    activate(): void {
        if (this.status === UnitOfMeasureStatus.ACTIVE) {
            return;
        }

        this.status = UnitOfMeasureStatus.ACTIVE;
        this.touch();
    }

    deactivate(): void {
        if (this.status === UnitOfMeasureStatus.INACTIVE) {
            return;
        }

        this.status = UnitOfMeasureStatus.INACTIVE;
        this.touch();
    }

    isActive(): boolean {
        return this.status === UnitOfMeasureStatus.ACTIVE;
    }

    isInactive(): boolean {
        return this.status === UnitOfMeasureStatus.INACTIVE;
    }

    canRepresentQuantity(decimalPlaces: number): boolean {
        if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0) {
            return false;
        }

        if (!this.allowsFraction) {
            return decimalPlaces === 0;
        }

        return decimalPlaces <= this.decimalPlaces;
    }

    validateQuantity(quantity: Decimal.Value): void {
        let dec: Decimal;

        try {
            dec = new Decimal(quantity);
        } catch {
            throw new InvalidUnitOfMeasureException('La cantidad debe ser un número decimal válido');
        }

        if (!dec.isFinite()) {
            throw new InvalidUnitOfMeasureException('La cantidad debe ser finita');
        }

        if (dec.isNegative()) {
            throw new InvalidUnitOfMeasureException('La cantidad no puede ser negativa');
        }

        if (!this.allowsFraction && !dec.isInteger()) {
            throw new InvalidUnitOfMeasureException(
                `La unidad ${this.code.toString()} no permite cantidades fraccionarias`,
            );
        }

        const fixed = dec.toFixed();
        const sep = fixed.indexOf('.');
        const decimalPlaces = sep === -1 ? 0 : fixed.length - sep - 1;

        if (decimalPlaces > this.decimalPlaces) {
            throw new InvalidUnitOfMeasureException(
                `La unidad ${this.code.toString()} admite máximo ${this.decimalPlaces} posiciones decimales`,
            );
        }
    }

    private validateFractionConfiguration(): void {
        if (!this.allowsFraction && this.decimalPlaces !== 0) {
            throw new InvalidUnitOfMeasureException(
                'Una unidad que no permite fracciones debe tener cero posiciones decimales',
            );
        }
    }

    private ensureActive(): void {
        if (this.status === UnitOfMeasureStatus.INACTIVE) {
            throw new InvalidUnitOfMeasureException(
                'No se puede modificar una unidad de medida inactiva',
            );
        }
    }

    private static validateIdentity(props: {
        id: string;
        tenantId: string;
    }): void {
        if (typeof props.id !== 'string' || !props.id.trim()) {
            throw new InvalidUnitOfMeasureException(
                'El identificador de la unidad de medida es obligatorio',
            );
        }

        if (typeof props.tenantId !== 'string' || !props.tenantId.trim()) {
            throw new InvalidUnitOfMeasureException(
                'La unidad de medida debe pertenecer a un tenant',
            );
        }
    }

    private static validateType(type: UnitType): void {
        if (!Object.values(UnitType).includes(type)) {
            throw new InvalidUnitOfMeasureException(
                'El tipo de unidad de medida no es válido',
            );
        }
    }

    private static validateDecimalPlaces(decimalPlaces: number): void {
        if (!Number.isInteger(decimalPlaces)) {
            throw new InvalidUnitOfMeasureException(
                'La cantidad de posiciones decimales debe ser un número entero',
            );
        }

        if (
            decimalPlaces < UnitOfMeasure.MIN_DECIMAL_PLACES ||
            decimalPlaces > UnitOfMeasure.MAX_DECIMAL_PLACES
        ) {
            throw new InvalidUnitOfMeasureException(
                `Las posiciones decimales deben estar entre ${UnitOfMeasure.MIN_DECIMAL_PLACES} y ${UnitOfMeasure.MAX_DECIMAL_PLACES}`,
            );
        }
    }

    private touch(): void {
        this.updatedAt = new Date();
    }

    getId(): string {
        return this.id;
    }

    getTenantId(): string {
        return this.tenantId;
    }

    getCode(): UnitOfMeasureCodeVO {
        return this.code;
    }

    getName(): string {
        return this.name;
    }

    getType(): UnitType {
        return this.type;
    }

    getAllowsFraction(): boolean {
        return this.allowsFraction;
    }

    getDecimalPlaces(): number {
        return this.decimalPlaces;
    }

    getStatus(): UnitOfMeasureStatus {
        return this.status;
    }

    getCreatedAt(): Date {
        return this.createdAt;
    }

    getUpdatedAt(): Date {
        return this.updatedAt;
    }
}