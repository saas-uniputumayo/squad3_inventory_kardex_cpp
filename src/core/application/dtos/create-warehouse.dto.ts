import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateWarehouseDto {
  @ApiProperty({ description: 'ID de la sucursal a la que pertenece la bodega' })
  @IsUUID()
  @IsNotEmpty()
  branchId: string;

  @ApiProperty({ description: 'Codigo corto de la bodega', example: 'BOD-CENTRO' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'Nombre oficial de la bodega', example: 'Bodega Principal Centro' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Direccion fisica de la bodega' })
  @IsString()
  @IsOptional()
  address?: string;
}
