import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductStockInfoDto {
    @ApiProperty({ example: '100.0000', description: 'Cantidad total física en existencia' })
    quantityOnHand!: string;

    @ApiProperty({ example: '0.0000', description: 'Cantidad reservada en pedidos' })
    reservedQuantity!: string;

    @ApiProperty({ example: '100.0000', description: 'Cantidad disponible para la venta' })
    availableQuantity!: string;

    @ApiProperty({ example: '1500.0000', description: 'Costo promedio ponderado (CPP) unitario' })
    averageCost!: string;

    @ApiProperty({ example: '150000.0000', description: 'Valor total del inventario valorizado a CPP' })
    inventoryValue!: string;
}

export class ProductUnitOfMeasureDto {
    @ApiProperty({ example: '11111111-1111-1111-1111-111111111111' })
    id!: string;

    @ApiProperty({ example: 'UND' })
    code!: string;

    @ApiProperty({ example: 'Unidad' })
    name!: string;
}

export class ProductListItemResponseDto {
    @ApiProperty({ example: '00000000-0000-0000-0000-000000000001' })
    id!: string;

    @ApiProperty({ example: 'SKU-AREPA-001' })
    sku!: string;

    @ApiPropertyOptional({ example: '7701234567890', nullable: true })
    barcode!: string | null;

    @ApiProperty({ example: 'Arepa de Maíz Peto' })
    name!: string;

    @ApiPropertyOptional({ example: 'Descripción del producto', nullable: true })
    description!: string | null;

    @ApiPropertyOptional({ example: '00000000-0000-0000-0000-000000000002', nullable: true })
    categoryId!: string | null;

    @ApiProperty({ type: ProductUnitOfMeasureDto })
    unitOfMeasure!: ProductUnitOfMeasureDto;

    @ApiProperty({ example: '1500.0000' })
    costPrice!: string;

    @ApiProperty({ example: '2500.0000' })
    salePrice!: string;

    @ApiPropertyOptional({ example: '2200.0000', nullable: true })
    wholesalePrice!: string | null;

    @ApiProperty({ example: '19.0000' })
    taxRate!: string;

    @ApiProperty({ example: '10.0000' })
    minStockAlert!: string;

    @ApiProperty({ example: true })
    isActive!: boolean;

    @ApiPropertyOptional({ type: ProductStockInfoDto })
    stock?: ProductStockInfoDto;
}

export class SearchProductsResponseDto {
    @ApiProperty({ type: [ProductListItemResponseDto] })
    data!: ProductListItemResponseDto[];

    @ApiProperty({
        example: {
            page: 1,
            limit: 20,
            total: 1,
            totalPages: 1,
        },
    })
    pagination!: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export class CreateProductResponseDto {
    @ApiProperty({ example: '00000000-0000-0000-0000-000000000001' })
    id!: string;

    @ApiProperty({ example: 'SKU-AREPA-001' })
    sku!: string;

    @ApiProperty({ example: 'Arepa de Maíz Peto' })
    name!: string;

    @ApiProperty({ example: '11111111-1111-1111-1111-111111111111' })
    unitOfMeasureId!: string;

    @ApiProperty({ example: '2500.0000' })
    salePrice!: string;

    @ApiProperty({ example: '1500.0000' })
    costPrice!: string;

    @ApiProperty({ example: true })
    isActive!: boolean;

    @ApiPropertyOptional({ example: '22222222-2222-2222-2222-222222222222' })
    defaultVariantId?: string;

    @ApiProperty({ example: '2026-10-06T10:00:00.000Z' })
    createdAt!: Date;
}

export class UpdateProductResponseDto {
    @ApiProperty({ example: '00000000-0000-0000-0000-000000000001' })
    id!: string;

    @ApiProperty({ example: 'SKU-AREPA-001' })
    sku!: string;

    @ApiProperty({ example: 'Arepa de Maíz Peto' })
    name!: string;

    @ApiPropertyOptional({ example: 'Descripción del producto', nullable: true })
    description!: string | null;

    @ApiPropertyOptional({ example: '7701234567890', nullable: true })
    barcode!: string | null;

    @ApiPropertyOptional({ example: '00000000-0000-0000-0000-000000000002', nullable: true })
    categoryId!: string | null;

    @ApiProperty({ example: '11111111-1111-1111-1111-111111111111' })
    unitOfMeasureId!: string;

    @ApiProperty({ example: '1500.0000' })
    costPrice!: string;

    @ApiProperty({ example: '2500.0000' })
    salePrice!: string;

    @ApiPropertyOptional({ example: '2200.0000', nullable: true })
    wholesalePrice!: string | null;

    @ApiProperty({ example: '19.0000' })
    taxRate!: string;

    @ApiProperty({ example: '10.0000' })
    minStockAlert!: string;

    @ApiProperty({ example: true })
    isActive!: boolean;

    @ApiProperty({ example: '2026-10-06T10:00:00.000Z' })
    updatedAt!: Date;
}

export class ProductDetailResponseDto {
    @ApiProperty({ example: '00000000-0000-0000-0000-000000000001' })
    id!: string;

    @ApiProperty({ example: 'SKU-AREPA-001' })
    sku!: string;

    @ApiPropertyOptional({ example: '7701234567890', nullable: true })
    barcode!: string | null;

    @ApiProperty({ example: 'Arepa de Maíz Peto' })
    name!: string;

    @ApiPropertyOptional({ example: 'Descripción del producto', nullable: true })
    description!: string | null;

    @ApiPropertyOptional({ example: '00000000-0000-0000-0000-000000000002', nullable: true })
    categoryId!: string | null;

    @ApiProperty({ type: ProductUnitOfMeasureDto })
    unitOfMeasure!: ProductUnitOfMeasureDto;

    @ApiProperty({ example: '1500.0000' })
    costPrice!: string;

    @ApiProperty({ example: '2500.0000' })
    salePrice!: string;

    @ApiPropertyOptional({ example: '2200.0000', nullable: true })
    wholesalePrice!: string | null;

    @ApiProperty({ example: '19.0000' })
    taxRate!: string;

    @ApiProperty({ example: '10.0000' })
    minStockAlert!: string;

    @ApiProperty({ example: true })
    isActive!: boolean;

    @ApiPropertyOptional({ type: ProductStockInfoDto })
    stock?: ProductStockInfoDto;

    @ApiProperty({ example: '2026-10-06T10:00:00.000Z' })
    createdAt!: Date;

    @ApiProperty({ example: '2026-10-06T10:00:00.000Z' })
    updatedAt!: Date;
}
