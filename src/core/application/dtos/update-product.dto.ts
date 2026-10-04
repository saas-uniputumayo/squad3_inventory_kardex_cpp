import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateProductDto {
  @ApiPropertyOptional({ description: 'Descripcion detallada del producto' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Precio de venta al publico antes de IVA (COP)' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  salePrice?: number;

  @ApiPropertyOptional({ description: 'Precio de venta al por mayor (COP)' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  wholesalePrice?: number;

  @ApiPropertyOptional({ description: 'Umbral minimo de stock para alertas' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  minStockAlert?: number;
}
