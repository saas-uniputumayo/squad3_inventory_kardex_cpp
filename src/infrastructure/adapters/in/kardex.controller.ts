import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  Request,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InventoryService } from '../../../core/application/services/inventory.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TenantInterceptor } from './tenant.interceptor';

@ApiTags('Kardex NIIF y Alertas de Stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantInterceptor)
@Controller('api/v1/inventory')
export class KardexController {
  constructor(
    @Inject(InventoryService)
    private readonly inventoryService: InventoryService,
  ) {}

  @Get('kardex/:productId')
  @ApiOperation({
    summary: 'Consultar Kardex valorizado de un producto (Partida Doble e Inmutable)',
    description: 'Retorna el libro auxiliar de inventario por producto con historial cronológico, tipo de movimiento, saldos y costos unitarios NIIF.',
  })
  @ApiResponse({ status: 200, description: 'Kardex obtenido exitosamente.' })
  @ApiQuery({ name: 'warehouseId', required: false, description: 'Filtrar movimientos por bodega específica' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Fecha inicial (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Fecha final (ISO 8601)' })
  async getKardex(
    @Param('productId') productId: string,
    @Request() req: any,
    @Query('warehouseId') warehouseId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const tenantId: string = req.user.tenantId;
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const kardex = await this.inventoryService.getKardex(
      tenantId,
      productId,
      warehouseId,
      start,
      end,
    );

    return {
      statusCode: HttpStatus.OK,
      data: kardex,
    };
  }

  @Get('stock-alerts')
  @ApiOperation({
    summary: 'Consultar alertas de stock crítico o mínimo',
    description: 'Retorna los productos cuyo stock disponible total se encuentra por debajo o igual al umbral min_stock_alert.',
  })
  @ApiResponse({ status: 200, description: 'Alertas de stock obtenidas.' })
  async getStockAlerts(@Request() req: any) {
    const tenantId: string = req.user.tenantId;
    const alerts = await this.inventoryService.getStockAlerts(tenantId);
    return {
      statusCode: HttpStatus.OK,
      totalAlerts: alerts.length,
      data: alerts,
    };
  }
}
