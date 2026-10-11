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
    GetStockAlertsUseCase,
} from '../../../application/ports/in/get-stock-alerts.use-case';
import { GET_STOCK_ALERTS_USE_CASE } from '../../tokens';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AuthenticatedUser } from '../../decorators/current-user.decorator';
import { TenantInterceptor } from '../../interceptors/tenant.interceptor';
import { InventoryExceptionFilter } from '../../filters/inventory-exception.filter';
import { GetStockAlertsQueryDto } from '../../dto/stock-alerts/get-stock-alerts-query.dto';
import { StockAlertsResponseDto } from '../../dto/stock-alerts/stock-alerts-response.dto';
import { ErrorResponseDto } from '../../dto/common/error-response.dto';

@ApiTags('Inventory - Stock Alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
@UseFilters(InventoryExceptionFilter)
@Controller('inventory/stock-alerts')
export class StockAlertsController {
    constructor(
        @Inject(GET_STOCK_ALERTS_USE_CASE)
        private readonly getStockAlertsUseCase: GetStockAlertsUseCase,
    ) { }

    @Get()
    @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.WAREHOUSE_MANAGER)
    @ApiOperation({ summary: 'Get products below their configured minimum stock threshold' })
    @ApiResponse({ status: 200, description: 'List of low stock alert items', type: StockAlertsResponseDto })
    @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden role', type: ErrorResponseDto })
    async getAlerts(
        @Query() query: GetStockAlertsQueryDto,
        @CurrentUser() user: AuthenticatedUser,
    ): Promise<StockAlertsResponseDto> {
        return this.getStockAlertsUseCase.execute({
            tenantId: user.tenantId,
            warehouseId: query.warehouseId,
            search: query.search,
            page: query.page,
            limit: query.limit,
        });
    }
}
