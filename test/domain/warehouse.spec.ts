import { Warehouse } from '../../src/domain/entities/warehouse/entity';
import { InvalidWarehouseException } from '../../src/domain/exceptions/invalid-warehouse.exception';
import { WarehouseStatus } from '../../src/domain/types';
import { WarehouseCodeVO } from '../../src/domain/value-objects/warehouse-code.vo';

describe('Warehouse Entity', () => {
    it('should create valid active warehouse', () => {
        const wh = Warehouse.create({
            id: 'wh-001',
            tenantId: 'tenant-123',
            branchId: 'branch-001',
            code: WarehouseCodeVO.create('BOD-PRINCIPAL'),
            name: 'Bodega Principal Mocoa',
            description: 'Bodega principal de almacenamiento',
        });

        expect(wh.getId()).toBe('wh-001');
        expect(wh.getStatus()).toBe(WarehouseStatus.ACTIVE);
        expect(wh.canPerformInventoryOperations()).toBe(true);
        expect(wh.isActive()).toBe(true);
    });

    it('should support archiving warehouse and prevent inventory operations', () => {
        const wh = Warehouse.create({
            id: 'wh-002',
            tenantId: 'tenant-123',
            branchId: 'branch-001',
            code: WarehouseCodeVO.create('BOD-TEMP'),
            name: 'Bodega Temporal',
        });

        wh.archive();
        expect(wh.isArchived()).toBe(true);
        expect(wh.getStatus()).toBe(WarehouseStatus.ARCHIVED);
        expect(wh.getArchivedAt()).toBeDefined();
        expect(wh.canPerformInventoryOperations()).toBe(false);
    });

    it('should reject creation without code or name', () => {
        expect(() =>
            Warehouse.create({
                id: 'wh-003',
                tenantId: 'tenant-123',
                branchId: 'branch-001',
                code: WarehouseCodeVO.create('BOD-03'),
                name: '',
            }),
        ).toThrow(InvalidWarehouseException);
    });
});
