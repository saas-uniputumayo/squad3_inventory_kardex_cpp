import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class DispatchStockDto {
  @ApiProperty({ description: 'ID del producto a despachar' })
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ description: 'ID de la bodega origen del despacho' })
  @IsUUID()
  @IsNotEmpty()
  warehouseId: string;

  @ApiProperty({ description: 'Cantidad a despachar (permite fracciones)', example: 2.5 })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiPropertyOptional({ description: 'Documento de referencia contable/comercial', example: 'FACTURA_POS_001' })
  @IsString()
  @IsOptional()
  referenceDocument?: string;

  @ApiPropertyOptional({ description: 'ID del documento fuente (factura o comprobante)' })
  @IsUUID()
  @IsOptional()
  referenceDocumentId?: string;
}
