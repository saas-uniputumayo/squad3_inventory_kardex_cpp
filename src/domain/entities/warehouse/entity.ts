import { InvalidWarehouseException } from '../../exceptions/invalid-warehouse.exception';
import { WarehouseCodeVO } from '../../value-objects/warehouse-code.vo';

export enum WarehouseStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
}

export interface CreateWarehouseProps {
    id: string;
    tenantId: string;
    branchId: string;
    code: WarehouseCodeVO;
    name: string;
}

export interface WarehouseProps {
    id: string;
    tenantId: string;
    branchId: string;
    code: WarehouseCodeVO;
    name: string;
    status: WarehouseStatus;
    createdAt: Date;
    updatedAt: Date;
}

export class Warehouse {
    private constructor(
        private readonly id: string,
        private readonly tenantId: string,
        private readonly branchId: string,
        private code: WarehouseCodeVO,
        private name: string,
        private status: WarehouseStatus,
        private readonly createdAt: Date,
        private updatedAt: Date,
    ) { }

    static create(props: CreateWarehouseProps): Warehouse {
        if (!props.id.trim()) {
            throw new InvalidWarehouseException(
                'El identificador de la bodega es obligatorio',
            );
        }

        if (!props.tenantId.trim()) {
            throw new InvalidWarehouseException(
                'La bodega debe pertenecer a un tenant',
            );
        }

        if (!props.branchId.trim()) {
            throw new InvalidWarehouseException(
                'La bodega debe pertenecer a una sucursal',
            );
        }

        const name = props.name.trim();

        if (!name) {
            throw new InvalidWarehouseException(
                'El nombre de la bodega es obligatorio',
            );
        }

        if (name.length > 150) {
            throw new InvalidWarehouseException(
                'El nombre de la bodega no puede superar los 150 caracteres',
            );
        }

        const now = new Date();

        return new Warehouse(
            props.id,
            props.tenantId,
            props.branchId,
            props.code,
            name,
            WarehouseStatus.ACTIVE,
            now,
            now,
        );
    }

    static rehydrate(props: WarehouseProps): Warehouse {
        if (!props.id.trim()) {
            throw new InvalidWarehouseException(
                'El identificador de la bodega es obligatorio',
            );
        }

        if (!props.tenantId.trim()) {
            throw new InvalidWarehouseException(
                'La bodega debe pertenecer a un tenant',
            );
        }

        if (!props.branchId.trim()) {
            throw new InvalidWarehouseException(
                'La bodega debe pertenecer a una sucursal',
            );
        }

        if (!props.name.trim()) {
            throw new InvalidWarehouseException(
                'El nombre de la bodega es obligatorio',
            );
        }

        return new Warehouse(
            props.id,
            props.tenantId,
            props.branchId,
            props.code,
            props.name,
            props.status,
            props.createdAt,
            props.updatedAt,
        );
    }

    updateDetails(props: {
        code?: WarehouseCodeVO;
        name?: string;
    }): void {
        this.ensureActive();

        if (props.code !== undefined) {
            this.code = props.code;
        }

        if (props.name !== undefined) {
            const name = props.name.trim();

            if (!name) {
                throw new InvalidWarehouseException(
                    'El nombre de la bodega es obligatorio',
                );
            }

            if (name.length > 150) {
                throw new InvalidWarehouseException(
                    'El nombre de la bodega no puede superar los 150 caracteres',
                );
            }

            this.name = name;
        }

        this.touch();
    }

    activate(): void {
        if (this.status === WarehouseStatus.ACTIVE) {
            return;
        }

        this.status = WarehouseStatus.ACTIVE;
        this.touch();
    }

    deactivate(): void {
        if (this.status === WarehouseStatus.INACTIVE) {
            return;
        }

        this.status = WarehouseStatus.INACTIVE;
        this.touch();
    }

    isActive(): boolean {
        return this.status === WarehouseStatus.ACTIVE;
    }

    isInactive(): boolean {
        return this.status === WarehouseStatus.INACTIVE;
    }

    private ensureActive(): void {
        if (this.status === WarehouseStatus.INACTIVE) {
            throw new InvalidWarehouseException(
                'No se puede modificar una bodega inactiva',
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

    getBranchId(): string {
        return this.branchId;
    }

    getCode(): WarehouseCodeVO {
        return this.code;
    }

    getName(): string {
        return this.name;
    }

    getStatus(): WarehouseStatus {
        return this.status;
    }

    getCreatedAt(): Date {
        return this.createdAt;
    }

    getUpdatedAt(): Date {
        return this.updatedAt;
    }
}