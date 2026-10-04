import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class TransferStockDto {
  @ApiProperty({ description: 'ID del producto a trasladar' })
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ description: 'ID de la bodega origen' })
  @IsUUID()
  @IsNotEmpty()
  sourceWarehouseId: string;

  @ApiProperty({ description: 'ID de la bodega destino' })
  @IsUUID()
  @IsNotEmpty()
  targetWarehouseId: string;

  @ApiProperty({ description: 'Cantidad a trasladar (permite fracciones)', example: 10.0 })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiPropertyOptional({ description: 'Numero de guia de remision o traslado', example: 'REMISION_TRASLADO_001' })
  @IsString()
  @IsOptional()
  referenceDocument?: string;
}
