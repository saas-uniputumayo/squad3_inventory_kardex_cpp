import {
    ListWarehousesQuery,
    ListWarehousesUseCase,
    WarehouseListItemResult,
} from '../../ports/in/list-warehouses.use-case';
import { WarehouseRepositoryPort } from '../../ports/out/warehouse-repository.port';

export class ListWarehousesService implements ListWarehousesUseCase {
    constructor(
        private readonly warehouseRepository: WarehouseRepositoryPort,
    ) { }

    async execute(
        query: ListWarehousesQuery,
    ): Promise<WarehouseListItemResult[]> {
        const onlyActive = query.onlyActive ?? true;

        const warehouses = await this.warehouseRepository.findAll(
            query.tenantId,
            {
                onlyActive,
                branchId: query.branchId,
            },
        );

        return warehouses.map((wh) => ({
            id: wh.getId(),
            code: wh.getCode().getValue(),
            name: wh.getName(),
            description: wh.getDescription(),
            branchId: wh.getBranchId(),
            status: wh.getStatus(),
            isActive: wh.isActive(),
        }));
    }
}
