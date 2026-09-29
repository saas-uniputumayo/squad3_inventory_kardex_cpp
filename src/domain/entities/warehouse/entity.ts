import { InvalidWarehouseException } from '../../exceptions/invalid-warehouse.exception';
import { WarehouseCodeVO } from '../../value-objects/warehouse-code.vo';
import { WarehouseStatus } from '../../types';

export { WarehouseStatus };

export interface CreateWarehouseProps {
    id: string;
    tenantId: string;
    branchId: string;
    code: WarehouseCodeVO;
    name: string;
    description?: string | null;
}

export interface WarehouseProps {
    id: string;
    tenantId: string;
    branchId: string;
    code: WarehouseCodeVO;
    name: string;
    description?: string | null;
    status: WarehouseStatus;
    createdAt: Date;
    updatedAt: Date;
    archivedAt?: Date | null;
}

export class Warehouse {
    public static readonly MAX_NAME_LENGTH = 100; // Coincide con schema.prisma VarChar(100)

    private constructor(
        private readonly id: string,
        private readonly tenantId: string,
        private readonly branchId: string,
        private code: WarehouseCodeVO,
        private name: string,
        private description: string | null,
        private status: WarehouseStatus,
        private readonly createdAt: Date,
        private updatedAt: Date,
        private archivedAt: Date | null,
    ) { }

    static create(props: CreateWarehouseProps): Warehouse {
        Warehouse.validateIdentity(props);

        const name = props.name.trim();

        if (!name) {
            throw new InvalidWarehouseException(
                'El nombre de la bodega es obligatorio',
            );
        }

        if (name.length > Warehouse.MAX_NAME_LENGTH) {
            throw new InvalidWarehouseException(
                `El nombre de la bodega no puede superar los ${Warehouse.MAX_NAME_LENGTH} caracteres`,
            );
        }

        const now = new Date();

        return new Warehouse(
            props.id,
            props.tenantId,
            props.branchId,
            props.code,
            name,
            props.description?.trim() || null,
            WarehouseStatus.ACTIVE,
            now,
            now,
            null,
        );
    }

    static rehydrate(props: WarehouseProps): Warehouse {
        Warehouse.validateIdentity(props);

        if (!props.name || !props.name.trim()) {
            throw new InvalidWarehouseException(
                'El nombre de la bodega es obligatorio',
            );
        }

        if (!Object.values(WarehouseStatus).includes(props.status)) {
            throw new InvalidWarehouseException(
                'El estado de la bodega no es válido',
            );
        }

        return new Warehouse(
            props.id,
            props.tenantId,
            props.branchId,
            props.code,
            props.name.trim(),
            props.description ?? null,
            props.status,
            props.createdAt,
            props.updatedAt,
            props.archivedAt ?? null,
        );
    }

    updateDetails(props: {
        code?: WarehouseCodeVO;
        name?: string;
        description?: string | null;
    }): void {
        this.ensureNotArchived();
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

            if (name.length > Warehouse.MAX_NAME_LENGTH) {
                throw new InvalidWarehouseException(
                    `El nombre de la bodega no puede superar los ${Warehouse.MAX_NAME_LENGTH} caracteres`,
                );
            }

            this.name = name;
        }

        if (props.description !== undefined) {
            this.description = props.description?.trim() || null;
        }

        this.touch();
    }

    activate(): void {
        this.ensureNotArchived();

        if (this.status === WarehouseStatus.ACTIVE) {
            return;
        }

        this.status = WarehouseStatus.ACTIVE;
        this.touch();
    }

    deactivate(): void {
        this.ensureNotArchived();

        if (this.status === WarehouseStatus.INACTIVE) {
            return;
        }

        this.status = WarehouseStatus.INACTIVE;
        this.touch();
    }

    archive(): void {
        if (this.status === WarehouseStatus.ARCHIVED) {
            return;
        }

        this.status = WarehouseStatus.ARCHIVED;
        this.archivedAt = new Date();
        this.touch();
    }

    isActive(): boolean {
        return this.status === WarehouseStatus.ACTIVE;
    }

    isInactive(): boolean {
        return this.status === WarehouseStatus.INACTIVE;
    }

    isArchived(): boolean {
        return this.status === WarehouseStatus.ARCHIVED;
    }

    canOperate(): boolean {
        return this.status === WarehouseStatus.ACTIVE;
    }

    private ensureActive(): void {
        if (this.status === WarehouseStatus.INACTIVE) {
            throw new InvalidWarehouseException(
                'No se puede modificar una bodega inactiva',
            );
        }
    }

    canPerformInventoryOperations(): boolean {
        return this.status === WarehouseStatus.ACTIVE;
    }

    private ensureNotArchived(): void {
        if (this.status === WarehouseStatus.ARCHIVED) {
            throw new InvalidWarehouseException(
                'No se puede operar ni modificar una bodega archivada',
            );
        }
    }

    private static validateIdentity(props: {
        id: string;
        tenantId: string;
        branchId: string;
    }): void {
        if (typeof props.id !== 'string' || !props.id.trim()) {
            throw new InvalidWarehouseException(
                'El identificador de la bodega es obligatorio',
            );
        }

        if (typeof props.tenantId !== 'string' || !props.tenantId.trim()) {
            throw new InvalidWarehouseException(
                'La bodega debe pertenecer a un tenant',
            );
        }

        if (typeof props.branchId !== 'string' || !props.branchId.trim()) {
            throw new InvalidWarehouseException(
                'La bodega debe pertenecer a una sucursal',
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

    getDescription(): string | null {
        return this.description;
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

    getArchivedAt(): Date | null {
        return this.archivedAt;
    }
}