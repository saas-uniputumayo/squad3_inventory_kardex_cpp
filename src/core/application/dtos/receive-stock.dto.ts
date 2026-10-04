import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min } from 'class-validator';

export class ReceiveStockDto {
  @ApiProperty({ description: 'ID del producto recibido' })
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ description: 'ID de la bodega destino' })
  @IsUUID()
  @IsNotEmpty()
  warehouseId: string;

  @ApiProperty({ description: 'Cantidad recibida (permite fracciones)', example: 50.0 })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty({ description: 'Costo unitario de compra en factura de proveedor (COP)', example: 25000.0 })
  @IsNumber()
  @Min(0)
  unitCost: number;

  @ApiPropertyOptional({ description: 'Documento de referencia de compra', example: 'COMPRA_FAC_001' })
  @IsString()
  @IsOptional()
  referenceDocument?: string;

  @ApiPropertyOptional({ description: 'ID del documento de compra' })
  @IsUUID()
  @IsOptional()
  referenceDocumentId?: string;
}
