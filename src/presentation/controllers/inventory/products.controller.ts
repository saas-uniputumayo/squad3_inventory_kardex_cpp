import {
    Body,
    Controller,
    Get,
    Inject,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
    UseFilters,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiBody,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import Decimal from 'decimal.js';
import { UserRole } from '../../types/roles';
import {
    CreateProductUseCase,
} from '../../../application/ports/in/create-product.use-case';
import {
    UpdateProductUseCase,
} from '../../../application/ports/in/update-product.use-case';
import {
    SearchProductsUseCase,
} from '../../../application/ports/in/search-products.use-case';
import {
    GetProductDetailUseCase,
} from '../../../application/ports/in/get-product-detail.use-case';
import {
    CREATE_PRODUCT_USE_CASE,
    GET_PRODUCT_DETAIL_USE_CASE,
    SEARCH_PRODUCTS_USE_CASE,
    UPDATE_PRODUCT_USE_CASE,
} from '../../tokens';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AuthenticatedUser } from '../../decorators/current-user.decorator';
import { TenantInterceptor } from '../../interceptors/tenant.interceptor';
import { InventoryExceptionFilter } from '../../filters/inventory-exception.filter';
import { CreateProductDto } from '../../dto/products/create-product.dto';
import { UpdateProductDto } from '../../dto/products/update-product.dto';
import { SearchProductsQueryDto } from '../../dto/products/search-products-query.dto';
import {
    CreateProductResponseDto,
    ProductDetailResponseDto,
    SearchProductsResponseDto,
    UpdateProductResponseDto,
} from '../../dto/products/product-response.dto';
import { ErrorResponseDto } from '../../dto/common/error-response.dto';

@ApiTags('Inventory - Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
@UseFilters(InventoryExceptionFilter)
@Controller('inventory/products')
export class ProductsController {
    constructor(
        @Inject(CREATE_PRODUCT_USE_CASE)
        private readonly createProductUseCase: CreateProductUseCase,
        @Inject(UPDATE_PRODUCT_USE_CASE)
        private readonly updateProductUseCase: UpdateProductUseCase,
        @Inject(SEARCH_PRODUCTS_USE_CASE)
        private readonly searchProductsUseCase: SearchProductsUseCase,
        @Inject(GET_PRODUCT_DETAIL_USE_CASE)
        private readonly getProductDetailUseCase: GetProductDetailUseCase,
    ) { }

    @Post()
    @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER)
    @ApiOperation({ summary: 'Crear un nuevo producto en el catálogo' })
    @ApiBody({ type: CreateProductDto })
    @ApiResponse({ status: 201, description: 'Producto creado exitosamente', type: CreateProductResponseDto })
    @ApiResponse({ status: 400, description: 'Datos de entrada inválidos o error de validación', type: ErrorResponseDto })
    @ApiResponse({ status: 401, description: 'No autorizado / Token ausente o inválido', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Acceso denegado: rol no autorizado', type: ErrorResponseDto })
    @ApiResponse({ status: 409, description: 'Conflicto: SKU o código de barras duplicado', type: ErrorResponseDto })
    async create(
        @Body() dto: CreateProductDto,
        @CurrentUser() user: AuthenticatedUser,
    ): Promise<CreateProductResponseDto> {
        return this.createProductUseCase.execute({
            tenantId: user.tenantId,
            sku: dto.sku,
            name: dto.name,
            description: dto.description,
            barcode: dto.barcode,
            categoryId: dto.categoryId,
            productType: dto.productType,
            structure: dto.structure,
            unitOfMeasureId: dto.unitOfMeasureId,
            costPrice: new Decimal(dto.costPrice),
            salePrice: new Decimal(dto.salePrice),
            wholesalePrice: dto.wholesalePrice !== undefined && dto.wholesalePrice !== null
                ? new Decimal(dto.wholesalePrice)
                : undefined,
            taxRate: dto.taxRate !== undefined && dto.taxRate !== null
                ? new Decimal(dto.taxRate)
                : undefined,
            minStockAlert: dto.minStockAlert !== undefined && dto.minStockAlert !== null
                ? new Decimal(dto.minStockAlert)
                : undefined,
            costMethod: dto.costMethod,
        });
    }

    @Patch(':id')
    @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER)
    @ApiOperation({ summary: 'Actualizar un producto existente o modificar su estado' })
    @ApiParam({ name: 'id', description: 'Identificador UUID del producto' })
    @ApiBody({ type: UpdateProductDto })
    @ApiResponse({ status: 200, description: 'Producto actualizado exitosamente', type: UpdateProductResponseDto })
    @ApiResponse({ status: 400, description: 'Error de validación en los campos', type: ErrorResponseDto })
    @ApiResponse({ status: 401, description: 'No autorizado / Token ausente o inválido', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Acceso denegado: rol no autorizado', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Producto no encontrado', type: ErrorResponseDto })
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateProductDto,
        @CurrentUser() user: AuthenticatedUser,
    ): Promise<UpdateProductResponseDto> {
        return this.updateProductUseCase.execute({
            tenantId: user.tenantId,
            productId: id,
            name: dto.name,
            description: dto.description,
            barcode: dto.barcode,
            categoryId: dto.categoryId,
            salePrice: dto.salePrice !== undefined && dto.salePrice !== null ? new Decimal(dto.salePrice) : undefined,
            wholesalePrice: dto.wholesalePrice !== undefined && dto.wholesalePrice !== null
                ? new Decimal(dto.wholesalePrice)
                : undefined,
            costPrice: dto.costPrice !== undefined && dto.costPrice !== null ? new Decimal(dto.costPrice) : undefined,
            taxRate: dto.taxRate !== undefined && dto.taxRate !== null ? new Decimal(dto.taxRate) : undefined,
            minStockAlert: dto.minStockAlert !== undefined && dto.minStockAlert !== null
                ? new Decimal(dto.minStockAlert)
                : undefined,
            unitOfMeasureId: dto.unitOfMeasureId,
            isActive: dto.isActive,
        });
    }

    @Get()
    @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.WAREHOUSE_MANAGER, UserRole.CASHIER)
    @ApiOperation({ summary: 'Buscar y listar productos con resumen opcional de existencias' })
    @ApiResponse({ status: 200, description: 'Lista paginada de productos', type: SearchProductsResponseDto })
    @ApiResponse({ status: 401, description: 'No autorizado / Token ausente o inválido', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Acceso denegado: rol no autorizado', type: ErrorResponseDto })
    async search(
        @Query() query: SearchProductsQueryDto,
        @CurrentUser() user: AuthenticatedUser,
    ): Promise<SearchProductsResponseDto> {
        return this.searchProductsUseCase.execute({
            tenantId: user.tenantId,
            search: query.search,
            sku: query.sku,
            barcode: query.barcode,
            categoryId: query.categoryId,
            warehouseId: query.warehouseId,
            isActive: query.isActive,
            page: query.page,
            limit: query.limit,
        });
    }

    @Get(':id')
    @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.WAREHOUSE_MANAGER, UserRole.CASHIER)
    @ApiOperation({ summary: 'Obtener detalle del producto por ID con existencias por bodega' })
    @ApiParam({ name: 'id', description: 'Identificador UUID del producto' })
    @ApiQuery({ name: 'warehouseId', required: false, description: 'UUID de bodega opcional para desglose de stock' })
    @ApiResponse({ status: 200, description: 'Detalle del producto y sus variantes', type: ProductDetailResponseDto })
    @ApiResponse({ status: 401, description: 'No autorizado / Token ausente o inválido', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Acceso denegado: rol no autorizado', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Producto no encontrado', type: ErrorResponseDto })
    async getDetail(
        @Param('id', ParseUUIDPipe) id: string,
        @Query('warehouseId', new ParseUUIDPipe({ optional: true })) warehouseId: string | undefined,
        @CurrentUser() user: AuthenticatedUser,
    ): Promise<ProductDetailResponseDto> {
        return this.getProductDetailUseCase.execute({
            tenantId: user.tenantId,
            productId: id,
            warehouseId,
        });
    }
}
