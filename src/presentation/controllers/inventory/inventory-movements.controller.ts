import {
    Body,
    Controller,
    Headers,
    HttpCode,
    HttpStatus,
    Inject,
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
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import Decimal from 'decimal.js';
import { UserRole } from '../../types/roles';
import {
    ReceiveStockUseCase,
} from '../../../application/ports/in/receive-stock.use-case';
import {
    DispatchStockUseCase,
} from '../../../application/ports/in/dispatch-stock.use-case';
import {
    ReverseMovementUseCase,
} from '../../../application/ports/in/reverse-movement.use-case';
import {
    DISPATCH_STOCK_USE_CASE,
    RECEIVE_STOCK_USE_CASE,
    REVERSE_MOVEMENT_USE_CASE,
} from '../../tokens';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AuthenticatedUser } from '../../decorators/current-user.decorator';
import { TenantInterceptor } from '../../interceptors/tenant.interceptor';
import { InventoryExceptionFilter } from '../../filters/inventory-exception.filter';
import { ReceiveStockDto } from '../../dto/movements/receive-stock.dto';
import { DispatchStockDto } from '../../dto/movements/dispatch-stock.dto';
import { ReverseMovementDto } from '../../dto/movements/reverse-movement.dto';
import {
    DispatchStockResponseDto,
    ReceiveStockResponseDto,
    ReverseMovementResponseDto,
} from '../../dto/movements/movement-response.dto';
import { ErrorResponseDto } from '../../dto/common/error-response.dto';

@ApiTags('Inventory - Movements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
@UseFilters(InventoryExceptionFilter)
@Controller('inventory/moves')
export class InventoryMovementsController {
    constructor(
        @Inject(RECEIVE_STOCK_USE_CASE)
        private readonly receiveStockUseCase: ReceiveStockUseCase,
        @Inject(DISPATCH_STOCK_USE_CASE)
        private readonly dispatchStockUseCase: DispatchStockUseCase,
        @Inject(REVERSE_MOVEMENT_USE_CASE)
        private readonly reverseMovementUseCase: ReverseMovementUseCase,
    ) { }

    @Post('receive')
    @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER)
    @ApiOperation({ summary: 'Recibir inventario en bodega y recalcular el Costo Promedio Ponderado (CPP)' })
    @ApiHeader({ name: 'Idempotency-Key', required: false, description: 'Clave única opcional para garantizar ejecución idempotente' })
    @ApiBody({ type: ReceiveStockDto })
    @ApiResponse({ status: 201, description: 'Inventario recibido y asentado en Kardex', type: ReceiveStockResponseDto })
    @ApiResponse({ status: 400, description: 'Cantidades o costos inválidos, o error de validación', type: ErrorResponseDto })
    @ApiResponse({ status: 401, description: 'No autorizado / Token ausente o inválido', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Acceso denegado: rol no autorizado', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Bodega, producto o unidad de medida no encontrada', type: ErrorResponseDto })
    @ApiResponse({ status: 409, description: 'Conflicto de idempotencia o concurrencia', type: ErrorResponseDto })
    async receive(
        @Body() dto: ReceiveStockDto,
        @CurrentUser() user: AuthenticatedUser,
        @Headers('idempotency-key') idempotencyKey?: string,
    ): Promise<ReceiveStockResponseDto> {
        return this.receiveStockUseCase.execute({
            tenantId: user.tenantId,
            warehouseId: dto.warehouseId,
            referenceType: dto.referenceType,
            referenceId: dto.referenceId,
            referenceDocument: dto.referenceDocument,
            source: dto.source,
            notes: dto.notes,
            performedById: user.sub,
            occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
            idempotencyKey,
            lines: dto.lines.map((l) => ({
                productId: l.productId,
                variantId: l.variantId,
                quantity: new Decimal(l.quantity),
                unitCost: new Decimal(l.unitCost),
            })),
        });
    }

    @Post('dispatch')
    @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.CASHIER)
    @ApiOperation({ summary: 'Despachar inventario de bodega con valuación CPP y prevención de stock negativo' })
    @ApiHeader({ name: 'Idempotency-Key', required: false, description: 'Clave única opcional para garantizar ejecución idempotente' })
    @ApiBody({ type: DispatchStockDto })
    @ApiResponse({ status: 201, description: 'Inventario despachado y asentado en Kardex', type: DispatchStockResponseDto })
    @ApiResponse({ status: 400, description: 'Stock insuficiente o datos de entrada inválidos', type: ErrorResponseDto })
    @ApiResponse({ status: 401, description: 'No autorizado / Token ausente o inválido', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Acceso denegado: rol no autorizado', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Bodega, producto o balance no encontrado', type: ErrorResponseDto })
    @ApiResponse({ status: 409, description: 'Conflicto de idempotencia o concurrencia', type: ErrorResponseDto })
    async dispatch(
        @Body() dto: DispatchStockDto,
        @CurrentUser() user: AuthenticatedUser,
        @Headers('idempotency-key') idempotencyKey?: string,
    ): Promise<DispatchStockResponseDto> {
        return this.dispatchStockUseCase.execute({
            tenantId: user.tenantId,
            warehouseId: dto.warehouseId,
            referenceType: dto.referenceType,
            referenceId: dto.referenceId,
            referenceDocument: dto.referenceDocument,
            source: dto.source,
            notes: dto.notes,
            performedById: user.sub,
            occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
            idempotencyKey,
            lines: dto.lines.map((l) => ({
                productId: l.productId,
                variantId: l.variantId,
                quantity: new Decimal(l.quantity),
            })),
        });
    }

    @Post('reverse')
    @HttpCode(HttpStatus.OK)
    @Roles(UserRole.OWNER, UserRole.ADMIN)
    @ApiOperation({ summary: 'Revertir un movimiento previo generando contra-asientos compensatorios en Kardex' })
    @ApiHeader({ name: 'Idempotency-Key', required: false, description: 'Clave única opcional para garantizar ejecución idempotente' })
    @ApiBody({ type: ReverseMovementDto })
    @ApiResponse({ status: 200, description: 'Movimiento revertido exitosamente', type: ReverseMovementResponseDto })
    @ApiResponse({ status: 400, description: 'El movimiento no puede ser revertido o ya fue revertido previamente', type: ErrorResponseDto })
    @ApiResponse({ status: 401, description: 'No autorizado / Token ausente o inválido', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Acceso denegado: requiere rol OWNER o ADMIN', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Movimiento original no encontrado', type: ErrorResponseDto })
    @ApiResponse({ status: 409, description: 'Conflicto de idempotencia o concurrencia', type: ErrorResponseDto })
    async reverse(
        @Body() dto: ReverseMovementDto,
        @CurrentUser() user: AuthenticatedUser,
        @Headers('idempotency-key') idempotencyKey?: string,
    ): Promise<ReverseMovementResponseDto> {
        return this.reverseMovementUseCase.execute({
            tenantId: user.tenantId,
            movementId: dto.movementId,
            reason: dto.reason,
            referenceType: dto.referenceType,
            referenceId: dto.referenceId,
            referenceDocument: dto.referenceDocument,
            performedById: user.sub,
            idempotencyKey,
        });
    }
}
