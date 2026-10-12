import {
    Controller,
    Get,
    Inject,
    Param,
    ParseUUIDPipe,
    Query,
    UseFilters,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiParam,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '../../types/roles';
import {
    GetKardexUseCase,
} from '../../../application/ports/in/get-kardex.use-case';
import { GET_KARDEX_USE_CASE } from '../../tokens';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AuthenticatedUser } from '../../decorators/current-user.decorator';
import { TenantInterceptor } from '../../interceptors/tenant.interceptor';
import { InventoryExceptionFilter } from '../../filters/inventory-exception.filter';
import { GetKardexQueryDto } from '../../dto/kardex/get-kardex-query.dto';
import { KardexResponseDto } from '../../dto/kardex/kardex-response.dto';
import { ErrorResponseDto } from '../../dto/common/error-response.dto';

@ApiTags('Inventory - Kardex')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
@UseFilters(InventoryExceptionFilter)
@Controller('inventory/kardex')
export class KardexController {
    constructor(
        @Inject(GET_KARDEX_USE_CASE)
        private readonly getKardexUseCase: GetKardexUseCase,
    ) { }

    @Get(':productId')
    @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.WAREHOUSE_MANAGER)
    @ApiOperation({ summary: 'Obtener libro mayor oficial de Kardex (valuación CPP) para un producto' })
    @ApiParam({ name: 'productId', description: 'Identificador UUID del producto' })
    @ApiResponse({ status: 200, description: 'Movimientos de Kardex paginados e información del producto', type: KardexResponseDto })
    @ApiResponse({ status: 401, description: 'No autorizado / Token ausente o inválido', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Acceso denegado: rol no autorizado', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Producto no encontrado', type: ErrorResponseDto })
    async getKardex(
        @Param('productId', ParseUUIDPipe) productId: string,
        @Query() query: GetKardexQueryDto,
        @CurrentUser() user: AuthenticatedUser,
    ): Promise<KardexResponseDto> {
        return this.getKardexUseCase.execute({
            tenantId: user.tenantId,
            productId,
            variantId: query.variantId,
            warehouseId: query.warehouseId,
            from: query.from,
            to: query.to,
            movementType: query.movementType,
            page: query.page,
            limit: query.limit,
        });
    }
}
