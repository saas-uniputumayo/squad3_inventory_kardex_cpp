import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  Request,
  HttpStatus,
  HttpCode,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InventoryService } from '../../../core/application/services/inventory.service';
import { CreateWarehouseDto } from '../../../core/application/dtos/create-warehouse.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TenantInterceptor } from './tenant.interceptor';

@ApiTags('Bodegas y Almacenes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantInterceptor)
@Controller('api/v1/inventory/warehouses')
export class WarehousesController {
  constructor(
    @Inject(InventoryService)
    private readonly inventoryService: InventoryService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar nueva bodega o centro de distribución',
    description: 'Crea una bodega vinculada a una sucursal y tenant específicos.',
  })
  @ApiResponse({ status: 201, description: 'Bodega creada exitosamente.' })
  async createWarehouse(@Body() dto: CreateWarehouseDto, @Request() req: any) {
    const tenantId: string = req.user.tenantId;
    const warehouse = await this.inventoryService.createWarehouse(tenantId, dto);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Bodega creada exitosamente',
      data: {
        id: warehouse.id,
        branchId: warehouse.branchId,
        code: warehouse.code,
        name: warehouse.name,
        address: warehouse.address,
        isActive: warehouse.isActive,
      },
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Listar bodegas activas',
    description: 'Retorna todas las bodegas del tenant, opcionalmente filtradas por sucursal.',
  })
  @ApiQuery({ name: 'branchId', required: false, description: 'Filtrar por ID de sucursal' })
  async listWarehouses(@Request() req: any, @Query('branchId') branchId?: string) {
    const tenantId: string = req.user.tenantId;
    const warehouses = await this.inventoryService.listWarehouses(tenantId, branchId);
    return {
      statusCode: HttpStatus.OK,
      data: warehouses.map((w) => ({
        id: w.id,
        branchId: w.branchId,
        code: w.code,
        name: w.name,
        address: w.address,
        isActive: w.isActive,
      })),
    };
  }
}
