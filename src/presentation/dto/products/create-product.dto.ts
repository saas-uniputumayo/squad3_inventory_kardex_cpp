import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsEnum,
    IsNotEmpty,
    IsNumberString,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
} from 'class-validator';
import {
    CostMethod,
    ProductStructure,
    ProductType,
} from '../../../domain/types';

export class CreateProductDto {
    @ApiProperty({
        description: 'Código SKU único del producto',
        example: 'SKU-AREPA-001',
    })
    @IsString({ message: 'El SKU debe ser una cadena de texto' })
    @IsNotEmpty({ message: 'El SKU es obligatorio' })
    @MaxLength(50, { message: 'El SKU no puede exceder 50 caracteres' })
    sku: string;

    @ApiProperty({
        description: 'Nombre comercial del producto',
        example: 'Arepa de Maíz Peto x 5 uds',
    })
    @IsString({ message: 'El nombre debe ser una cadena de texto' })
    @IsNotEmpty({ message: 'El nombre del producto es obligatorio' })
    @MaxLength(200, { message: 'El nombre no puede exceder 200 caracteres' })
    name: string;

    @ApiPropertyOptional({
        description: 'Descripción detallada del producto',
        example: 'Paquete de 5 arepas precocidas de maíz peto',
    })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({
        description: 'Código de barras estándar (EAN-13, UPC, etc.)',
        example: '7701234567890',
    })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    barcode?: string;

    @ApiPropertyOptional({
        description: 'ID UUID de la categoría asociada',
        example: '00000000-0000-0000-0000-000000000001',
    })
    @IsOptional()
    @IsUUID('4', { message: 'categoryId debe ser un UUID válido' })
    categoryId?: string;

    @ApiPropertyOptional({
        description: 'Tipo de producto en el catálogo',
        enum: ProductType,
        default: ProductType.STOCKABLE,
    })
    @IsOptional()
    @IsEnum(ProductType, { message: 'productType inválido' })
    productType?: ProductType;

    @ApiPropertyOptional({
        description: 'Estructura del producto (SIMPLE o VARIABLE)',
        enum: ProductStructure,
        default: ProductStructure.SIMPLE,
    })
    @IsOptional()
    @IsEnum(ProductStructure, { message: 'structure inválido' })
    structure?: ProductStructure;

    @ApiProperty({
        description: 'ID UUID de la unidad de medida principal',
        example: '11111111-1111-1111-1111-111111111111',
    })
    @IsUUID('4', { message: 'unitOfMeasureId debe ser un UUID válido' })
    @IsNotEmpty({ message: 'unitOfMeasureId es obligatorio' })
    unitOfMeasureId: string;

    @ApiProperty({
        description: 'Costo unitario de adquisición inicial (formato decimal string)',
        example: '1500.0000',
    })
    @IsNumberString({}, { message: 'costPrice debe ser un valor numérico decimal válido' })
    @IsNotEmpty({ message: 'costPrice es obligatorio' })
    costPrice: string;

    @ApiProperty({
        description: 'Precio base de venta al público (formato decimal string)',
        example: '2500.0000',
    })
    @IsNumberString({}, { message: 'salePrice debe ser un valor numérico decimal válido' })
    @IsNotEmpty({ message: 'salePrice es obligatorio' })
    salePrice: string;

    @ApiPropertyOptional({
        description: 'Precio al por mayor opcional (formato decimal string)',
        example: '2200.0000',
    })
    @IsOptional()
    @IsNumberString({}, { message: 'wholesalePrice debe ser un valor numérico decimal' })
    wholesalePrice?: string;

    @ApiPropertyOptional({
        description: 'Porcentaje de IVA / Impuesto (ej: 0.0000 para exento, 19.0000 para 19%)',
        example: '19.0000',
        default: '0',
    })
    @IsOptional()
    @IsNumberString({}, { message: 'taxRate debe ser un valor numérico decimal' })
    taxRate?: string;

    @ApiPropertyOptional({
        description: 'Nivel mínimo de existencias para emitir alertas automáticas',
        example: '10.0000',
        default: '0',
    })
    @IsOptional()
    @IsNumberString({}, { message: 'minStockAlert debe ser un valor numérico decimal' })
    minStockAlert?: string;

    @ApiPropertyOptional({
        description: 'Método de valuación de inventario',
        enum: CostMethod,
        default: CostMethod.WEIGHTED_AVERAGE,
    })
    @IsOptional()
    @IsEnum(CostMethod, { message: 'costMethod inválido' })
    costMethod?: CostMethod;
}
