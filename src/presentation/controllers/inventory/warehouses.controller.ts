import {
    Controller,
    Get,
    Inject,
    Query,
    UseFilters,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '../../types/roles';
import {
    ListWarehousesUseCase,
} from '../../../application/ports/in/list-warehouses.use-case';
import { LIST_WAREHOUSES_USE_CASE } from '../../tokens';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AuthenticatedUser } from '../../decorators/current-user.decorator';
import { TenantInterceptor } from '../../interceptors/tenant.interceptor';
import { InventoryExceptionFilter } from '../../filters/inventory-exception.filter';
import { ListWarehousesQueryDto } from '../../dto/warehouses/list-warehouses-query.dto';
import { WarehouseResponseDto } from '../../dto/warehouses/warehouse-response.dto';
import { ErrorResponseDto } from '../../dto/common/error-response.dto';

@ApiTags('Inventory - Warehouses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
@UseFilters(InventoryExceptionFilter)
@Controller('inventory/warehouses')
export class WarehousesController {
    constructor(
        @Inject(LIST_WAREHOUSES_USE_CASE)
        private readonly listWarehousesUseCase: ListWarehousesUseCase,
    ) { }

    @Get()
    @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.WAREHOUSE_MANAGER, UserRole.CASHIER)
    @ApiOperation({ summary: 'Listar bodegas del tenant autenticado' })
    @ApiResponse({ status: 200, description: 'Lista de bodegas', type: [WarehouseResponseDto] })
    @ApiResponse({ status: 401, description: 'No autorizado / Token ausente o inválido', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Acceso denegado: rol no autorizado', type: ErrorResponseDto })
    async list(
        @Query() query: ListWarehousesQueryDto,
        @CurrentUser() user: AuthenticatedUser,
    ): Promise<WarehouseResponseDto[]> {
        return this.listWarehousesUseCase.execute({
            tenantId: user.tenantId,
            onlyActive: query.onlyActive,
            branchId: query.branchId,
        });
    }
}
