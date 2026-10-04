import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  Request,
  HttpStatus,
  HttpCode,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService } from '../../../core/application/services/inventory.service';
import { ReceiveStockDto } from '../../../core/application/dtos/receive-stock.dto';
import { DispatchStockDto } from '../../../core/application/dtos/dispatch-stock.dto';
import { ReverseMoveDto } from '../../../core/application/dtos/reverse-move.dto';
import { TransferStockDto } from '../../../core/application/dtos/transfer-stock.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TenantInterceptor } from './tenant.interceptor';

@ApiTags('Movimientos de Inventario y Operaciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantInterceptor)
@Controller('api/v1/inventory')
export class StockMovesController {
  constructor(
    @Inject(InventoryService)
    private readonly inventoryService: InventoryService,
  ) {}

  @Post('moves/receive')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar entrada de mercancía por compra con recálculo dinámico CPP',
    description: 'Incrementa el stock de la bodega y recalcula el Costo Promedio Ponderado NIIF del producto en tiempo real.',
  })
  @ApiResponse({ status: 201, description: 'Mercancía ingresada y CPP recalculado.' })
  async receiveStock(@Body() dto: ReceiveStockDto, @Request() req: any) {
    const tenantId: string = req.user.tenantId;
    const userId: string = req.user.userId;
    const result = await this.inventoryService.receiveStock(tenantId, dto, userId);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Entrada de inventario asentada exitosamente con recálculo de CPP',
      data: result,
    };
  }

  @Post('moves/dispatch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Despachar mercancía por venta POS (consumido por Squad 4/5 y Squad 2)',
    description: 'Aplica bloqueo pesimista en base de datos (SELECT FOR UPDATE), valida que no exista stock negativo, descuenta existencia y retorna el costo unitario exacto para la causación contable.',
  })
  @ApiResponse({ status: 200, description: 'Despacho efectuado exitosamente.' })
  async dispatchStock(@Body() dto: DispatchStockDto, @Request() req: any) {
    const tenantId: string = req.user.tenantId;
    const userId: string = req.user.userId;
    const result = await this.inventoryService.dispatchStock(tenantId, dto, userId);
    return {
      statusCode: HttpStatus.OK,
      message: 'Despacho de inventario confirmado exitosamente',
      data: result,
    };
  }

  @Post('moves/reverse')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reversar movimiento de inventario (anulación sin borrado destructivo)',
    description: 'Genera un contra-movimiento de tipo VOID_RETURN que restablece el stock previo sin eliminar el histórico.',
  })
  @ApiResponse({ status: 200, description: 'Reversión completada exitosamente.' })
  async reverseStockMove(@Body() dto: ReverseMoveDto, @Request() req: any) {
    const tenantId: string = req.user.tenantId;
    const userId: string = req.user.userId;
    const result = await this.inventoryService.reverseStockMove(tenantId, dto, userId);
    return {
      statusCode: HttpStatus.OK,
      message: 'Movimiento de inventario reversado exitosamente',
      data: result,
    };
  }

  @Post('transfers')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Traslado atómico de mercancía entre bodegas',
    description: 'Bloquea concurrentemente ambas bodegas, valida stock suficiente en origen y asienta TRANSFER_OUT y TRANSFER_IN en una única transacción ACID.',
  })
  @ApiResponse({ status: 201, description: 'Traslado inter-bodega completado.' })
  async transferStock(@Body() dto: TransferStockDto, @Request() req: any) {
    const tenantId: string = req.user.tenantId;
    const userId: string = req.user.userId;
    const result = await this.inventoryService.transferStock(tenantId, dto, userId);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Traslado inter-bodega ejecutado con éxito',
      data: result,
    };
  }
}
