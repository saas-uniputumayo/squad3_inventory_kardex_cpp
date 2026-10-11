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
    TransferStockUseCase,
} from '../../../application/ports/in/transfer-stock.use-case';
import {
    ReceiveTransferUseCase,
} from '../../../application/ports/in/receive-transfer.use-case';
import {
    RECEIVE_TRANSFER_USE_CASE,
    TRANSFER_STOCK_USE_CASE,
} from '../../tokens';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AuthenticatedUser } from '../../decorators/current-user.decorator';
import { TenantInterceptor } from '../../interceptors/tenant.interceptor';
import { InventoryExceptionFilter } from '../../filters/inventory-exception.filter';
import { TransferStockDto } from '../../dto/transfers/transfer-stock.dto';
import {
    ReceiveTransferResponseDto,
    TransferStockResponseDto,
} from '../../dto/transfers/transfer-response.dto';
import { ErrorResponseDto } from '../../dto/common/error-response.dto';

@ApiTags('Inventory - Transfers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
@UseFilters(InventoryExceptionFilter)
@Controller('inventory/transfers')
export class TransfersController {
    constructor(
        @Inject(TRANSFER_STOCK_USE_CASE)
        private readonly transferStockUseCase: TransferStockUseCase,
        @Inject(RECEIVE_TRANSFER_USE_CASE)
        private readonly receiveTransferUseCase: ReceiveTransferUseCase,
    ) { }

    @Post()
    @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER)
    @ApiOperation({ summary: 'Initiate a multi-warehouse transfer (direct or two-phase in-transit)' })
    @ApiHeader({ name: 'Idempotency-Key', required: false, description: 'Optional unique key to ensure idempotent execution' })
    @ApiBody({ type: TransferStockDto })
    @ApiResponse({ status: 201, description: 'Transfer initiated or completed', type: TransferStockResponseDto })
    @ApiResponse({ status: 400, description: 'Insufficient source stock or same warehouse error', type: ErrorResponseDto })
    @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden role', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Warehouse or product not found', type: ErrorResponseDto })
    @ApiResponse({ status: 409, description: 'Idempotency conflict or concurrent modification', type: ErrorResponseDto })
    async transfer(
        @Body() dto: TransferStockDto,
        @CurrentUser() user: AuthenticatedUser,
        @Headers('idempotency-key') idempotencyKey?: string,
    ): Promise<TransferStockResponseDto> {
        return this.transferStockUseCase.execute({
            tenantId: user.tenantId,
            sourceWarehouseId: dto.sourceWarehouseId,
            destinationWarehouseId: dto.destinationWarehouseId,
            referenceDocument: dto.referenceDocument,
            reason: dto.reason,
            notes: dto.notes,
            isTwoPhase: dto.isTwoPhase,
            performedById: user.sub,
            idempotencyKey,
            lines: dto.lines.map((l) => ({
                productId: l.productId,
                variantId: l.variantId,
                quantity: new Decimal(l.quantity),
            })),
        });
    }

    @Post(':id/receive')
    @HttpCode(HttpStatus.OK)
    @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER)
    @ApiOperation({ summary: 'Confirm receipt of an in-transit transfer at destination warehouse' })
    @ApiParam({ name: 'id', description: 'Transfer UUID' })
    @ApiHeader({ name: 'Idempotency-Key', required: false, description: 'Optional unique key to ensure idempotent execution' })
    @ApiResponse({ status: 200, description: 'Transfer received and finalized', type: ReceiveTransferResponseDto })
    @ApiResponse({ status: 400, description: 'Transfer is not in transit', type: ErrorResponseDto })
    @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden role', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Transfer not found', type: ErrorResponseDto })
    @ApiResponse({ status: 409, description: 'Idempotency conflict or concurrent modification', type: ErrorResponseDto })
    async receiveTransfer(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: AuthenticatedUser,
        @Headers('idempotency-key') idempotencyKey?: string,
    ): Promise<ReceiveTransferResponseDto> {
        return this.receiveTransferUseCase.execute({
            tenantId: user.tenantId,
            transferId: id,
            performedById: user.sub,
            idempotencyKey,
        });
    }
}
