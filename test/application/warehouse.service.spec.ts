import { ListWarehousesService } from '../../src/application/services/warehouse/list-warehouses.service';
import { Warehouse } from '../../src/domain/entities/warehouse/entity';
import { WarehouseCodeVO } from '../../src/domain/value-objects/warehouse-code.vo';
import { InMemoryWarehouseRepository } from './mocks/mock-ports';

describe('Warehouse Application Services (HU-04)', () => {
    const tenantId = 'tenant-test-1';
    let warehouseRepo: InMemoryWarehouseRepository;
    let listService: ListWarehousesService;

    beforeEach(async () => {
        warehouseRepo = new InMemoryWarehouseRepository();
        listService = new ListWarehousesService(warehouseRepo);

        const whPrincipal = Warehouse.create({
            id: 'wh-1',
            tenantId,
            branchId: 'branch-1',
            code: WarehouseCodeVO.create('BOD-01'),
            name: 'Bodega Principal',
        });

        const whSecundaria = Warehouse.create({
            id: 'wh-2',
            tenantId,
            branchId: 'branch-1',
            code: WarehouseCodeVO.create('BOD-02'),
            name: 'Bodega Secundaria',
        });

        await warehouseRepo.save(whPrincipal);
        await warehouseRepo.save(whSecundaria);
    });

    it('debe listar todas las bodegas activas del tenant', async () => {
        const result = await listService.execute({
            tenantId,
            onlyActive: true,
        });

        expect(result.length).toBe(2);
        expect(result.some((w) => w.code === 'BOD-01')).toBe(true);
        expect(result.some((w) => w.code === 'BOD-02')).toBe(true);
    });
});
