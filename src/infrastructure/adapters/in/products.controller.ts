import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
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
import { CreateProductDto } from '../../../core/application/dtos/create-product.dto';
import { UpdateProductDto } from '../../../core/application/dtos/update-product.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TenantInterceptor } from './tenant.interceptor';

@ApiTags('Productos e Inventario')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantInterceptor)
@Controller('api/v1/inventory/products')
export class ProductsController {
  constructor(
    @Inject(InventoryService)
    private readonly inventoryService: InventoryService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar nuevo producto en catálogo',
    description: 'Crea un producto asociado al tenant activo con SKU único, precios base y nivel de alerta de stock.',
  })
  @ApiResponse({ status: 201, description: 'Producto registrado exitosamente.' })
  async createProduct(@Body() dto: CreateProductDto, @Request() req: any) {
    const tenantId: string = req.user.tenantId;
    const product = await this.inventoryService.createProduct(tenantId, dto);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Producto creado exitosamente',
      data: {
        id: product.id,
        sku: product.sku,
        name: product.name,
        barcode: product.barcode,
        category: product.category,
        unitOfMeasure: product.unitOfMeasure,
        costPrice: product.costPrice.toNumber(),
        salePrice: product.salePrice,
        taxRate: product.taxRate,
        minStockAlert: product.minStockAlert.toNumber(),
        isActive: product.isActive,
      },
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Listar productos con existencias por bodega',
    description: 'Retorna el catálogo con balance de existencias totales, reservadas y desglose por bodega.',
  })
  @ApiQuery({ name: 'search', required: false, description: 'Búsqueda por nombre o SKU' })
  @ApiQuery({ name: 'category', required: false, description: 'Filtrar por categoría' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  async listProducts(
    @Request() req: any,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const tenantId: string = req.user.tenantId;
    const filters = {
      search,
      category,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    };

    const result = await this.inventoryService.listProducts(tenantId, filters);
    return {
      statusCode: HttpStatus.OK,
      total: result.total,
      data: result.data.map((item) => ({
        id: item.product.id,
        sku: item.product.sku,
        name: item.product.name,
        barcode: item.product.barcode,
        category: item.product.category,
        unitOfMeasure: item.product.unitOfMeasure,
        costPrice: item.product.costPrice.toNumber(),
        salePrice: item.product.salePrice,
        taxRate: item.product.taxRate,
        totalStockOnHand: item.totalStockOnHand,
        totalReserved: item.totalReserved,
        totalAvailable: item.totalAvailable,
        warehouses: item.warehousesStock,
      })),
    };
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar precios o parámetros de alerta de un producto',
    description: 'Permite actualizar precio de venta, alerta de stock mínimo o descripción.',
  })
  async updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @Request() req: any,
  ) {
    const tenantId: string = req.user.tenantId;
    const product = await this.inventoryService.updateProduct(tenantId, id, dto);
    return {
      statusCode: HttpStatus.OK,
      message: 'Producto actualizado exitosamente',
      data: {
        id: product.id,
        sku: product.sku,
        name: product.name,
        costPrice: product.costPrice.toNumber(),
        salePrice: product.salePrice,
        minStockAlert: product.minStockAlert.toNumber(),
        isActive: product.isActive,
      },
    };
  }
}
