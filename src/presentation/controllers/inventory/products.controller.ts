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
    @ApiOperation({ summary: 'Create a new catalog product' })
    @ApiBody({ type: CreateProductDto })
    @ApiResponse({ status: 201, description: 'Product successfully created', type: CreateProductResponseDto })
    @ApiResponse({ status: 400, description: 'Invalid input or validation error', type: ErrorResponseDto })
    @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden role', type: ErrorResponseDto })
    @ApiResponse({ status: 409, description: 'Duplicate SKU or barcode', type: ErrorResponseDto })
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
    @ApiOperation({ summary: 'Update an existing product (or activate/deactivate)' })
    @ApiParam({ name: 'id', description: 'Product UUID' })
    @ApiBody({ type: UpdateProductDto })
    @ApiResponse({ status: 200, description: 'Product successfully updated', type: UpdateProductResponseDto })
    @ApiResponse({ status: 400, description: 'Validation error', type: ErrorResponseDto })
    @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden role', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Product not found', type: ErrorResponseDto })
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
    @ApiOperation({ summary: 'Search and list products with optional stock summary' })
    @ApiResponse({ status: 200, description: 'Paginated list of products', type: SearchProductsResponseDto })
    @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden role', type: ErrorResponseDto })
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
    @ApiOperation({ summary: 'Get product detail by ID with warehouse stock info' })
    @ApiParam({ name: 'id', description: 'Product UUID' })
    @ApiQuery({ name: 'warehouseId', required: false, description: 'Warehouse UUID for stock breakdown' })
    @ApiResponse({ status: 200, description: 'Product details', type: ProductDetailResponseDto })
    @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden role', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Product not found', type: ErrorResponseDto })
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
