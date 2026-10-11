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
    @ApiOperation({ summary: 'Get official Kardex ledger entries (CPP weighted average) for a product' })
    @ApiParam({ name: 'productId', description: 'Product UUID' })
    @ApiResponse({ status: 200, description: 'Paginated Kardex ledger ledger entries and product info', type: KardexResponseDto })
    @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden role', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Product not found', type: ErrorResponseDto })
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
