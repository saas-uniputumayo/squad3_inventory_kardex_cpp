import {
    Body,
    Controller,
    Headers,
    HttpCode,
    HttpStatus,
    Inject,
    Param,
    ParseUUIDPipe,
    Post,
    UseFilters,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiBody,
    ApiHeader,
    ApiOperation,
    ApiParam,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import Decimal from 'decimal.js';
import { UserRole } from '../../types/roles';
import {
    CreateStockCountUseCase,
} from '../../../application/ports/in/create-stock-count.use-case';
import {
    ApplyStockCountUseCase,
} from '../../../application/ports/in/apply-stock-count.use-case';
import {
    APPLY_STOCK_COUNT_USE_CASE,
    CREATE_STOCK_COUNT_USE_CASE,
} from '../../tokens';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AuthenticatedUser } from '../../decorators/current-user.decorator';
import { TenantInterceptor } from '../../interceptors/tenant.interceptor';
import { InventoryExceptionFilter } from '../../filters/inventory-exception.filter';
import { CreateStockCountDto } from '../../dto/stock-counts/create-stock-count.dto';
import { ApplyStockCountDto } from '../../dto/stock-counts/apply-stock-count.dto';
import {
    ApplyStockCountResponseDto,
    CreateStockCountResponseDto,
} from '../../dto/stock-counts/stock-count-response.dto';
import { ErrorResponseDto } from '../../dto/common/error-response.dto';

@ApiTags('Inventory - Stock Counts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
@UseFilters(InventoryExceptionFilter)
@Controller('inventory/stock-counts')
export class StockCountsController {
    constructor(
        @Inject(CREATE_STOCK_COUNT_USE_CASE)
        private readonly createStockCountUseCase: CreateStockCountUseCase,
        @Inject(APPLY_STOCK_COUNT_USE_CASE)
        private readonly applyStockCountUseCase: ApplyStockCountUseCase,
    ) { }

    @Post()
    @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER)
    @ApiOperation({ summary: 'Crear sesión de auditoría para toma física de inventario en una bodega' })
    @ApiBody({ type: CreateStockCountDto })
    @ApiResponse({ status: 201, description: 'Sesión de toma física creada exitosamente', type: CreateStockCountResponseDto })
    @ApiResponse({ status: 400, description: 'Bodega inválida o ya existe una sesión activa de conteo', type: ErrorResponseDto })
    @ApiResponse({ status: 401, description: 'No autorizado / Token ausente o inválido', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Acceso denegado: rol no autorizado', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Bodega no encontrada', type: ErrorResponseDto })
    async create(
        @Body() dto: CreateStockCountDto,
        @CurrentUser() user: AuthenticatedUser,
    ): Promise<CreateStockCountResponseDto> {
        return this.createStockCountUseCase.execute({
            tenantId: user.tenantId,
            warehouseId: dto.warehouseId,
            notes: dto.notes,
            productIds: dto.productIds,
            autoStart: dto.autoStart,
            performedById: user.sub,
        });
    }

    @Post(':id/apply')
    @HttpCode(HttpStatus.OK)
    @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER)
    @ApiOperation({ summary: 'Aplicar ajustes de toma física generando movimientos de sobrante o faltante' })
    @ApiParam({ name: 'id', description: 'Identificador UUID de la toma física' })
    @ApiHeader({ name: 'Idempotency-Key', required: false, description: 'Clave única opcional para garantizar ejecución idempotente' })
    @ApiBody({ type: ApplyStockCountDto })
    @ApiResponse({ status: 200, description: 'Ajustes aplicados y balances de inventario actualizados', type: ApplyStockCountResponseDto })
    @ApiResponse({ status: 400, description: 'El conteo no está en progreso o presenta errores de validación', type: ErrorResponseDto })
    @ApiResponse({ status: 401, description: 'No autorizado / Token ausente o inválido', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Acceso denegado: rol no autorizado', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Toma física no encontrada', type: ErrorResponseDto })
    @ApiResponse({ status: 409, description: 'Conflicto de idempotencia o concurrencia', type: ErrorResponseDto })
    async apply(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: ApplyStockCountDto,
        @CurrentUser() user: AuthenticatedUser,
        @Headers('idempotency-key') idempotencyKey?: string,
    ): Promise<ApplyStockCountResponseDto> {
        return this.applyStockCountUseCase.execute({
            tenantId: user.tenantId,
            stockCountId: id,
            performedById: user.sub,
            idempotencyKey,
            counts: dto.counts?.map((c) => ({
                lineId: c.lineId,
                countedQuantity: new Decimal(c.countedQuantity),
                notes: c.notes,
            })),
        });
    }
}
