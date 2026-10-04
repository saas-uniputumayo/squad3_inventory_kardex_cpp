import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ description: 'Codigo SKU unico de inventario', example: 'CEM-001' })
  @IsString()
  @IsNotEmpty()
  sku: string;

  @ApiPropertyOptional({ description: 'Codigo de barras EAN13 o interno', example: '7701234567890' })
  @IsString()
  @IsOptional()
  barcode?: string;

  @ApiProperty({ description: 'Nombre comercial del producto', example: 'Cemento Gris Argos 50kg' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Descripcion detallada del producto' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Categoria de producto', example: 'CEMENTOS', default: 'GENERAL' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({
    description: 'Unidad de medida fraccionaria',
    example: 'BULTO',
    enum: ['UNIDAD', 'BULTO', 'KILO', 'METRO', 'LITRO', 'GALON', 'PAQUETE'],
  })
  @IsString()
  @IsNotEmpty()
  unitOfMeasure: string;

  @ApiPropertyOptional({ description: 'Costo inicial de compra unitario (COP)', example: 24500.0, default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  costPrice?: number;

  @ApiProperty({ description: 'Precio de venta al publico antes de IVA (COP)', example: 32000.0 })
  @IsNumber()
  @Min(0)
  salePrice: number;

  @ApiPropertyOptional({ description: 'Precio de venta al por mayor (COP)', example: 30000.0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  wholesalePrice?: number;

  @ApiPropertyOptional({ description: 'Tarifa de IVA (0.19 para 19%, 0.05 para 5%, 0 para exento)', default: 0.19 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  taxRate?: number;

  @ApiPropertyOptional({ description: 'Umbral minimo de stock para alertas', default: 5.0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  minStockAlert?: number;
}
