import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StockAlertItemResponseDto {
    @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
    productId!: string;

    @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
    variantId!: string;

    @ApiProperty({ example: 'SKU-001' })
    sku!: string;

    @ApiPropertyOptional({ example: '7701234567890' })
    barcode!: string | null;

    @ApiProperty({ example: 'Arroz Diana 1kg' })
    name!: string;

    @ApiProperty({ example: 'KG' })
    unitOfMeasure!: string;

    @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
    warehouseId!: string;

    @ApiProperty({ example: 'Bodega Principal' })
    warehouseName!: string;

    @ApiProperty({ example: '5.0000', description: 'Stock físico actual en existencia' })
    currentStock!: string;

    @ApiProperty({ example: '0.0000', description: 'Stock reservado para despachos pendientes' })
    reservedStock!: string;

    @ApiProperty({ example: '5.0000', description: 'Stock disponible para la venta' })
    availableStock!: string;

    @ApiProperty({ example: '20.0000', description: 'Umbral mínimo de seguridad de stock configurado' })
    minimumStock!: string;

    @ApiProperty({ example: '15.0000', description: 'Déficit o faltante por debajo del umbral mínimo' })
    shortage!: string;

    @ApiProperty({ example: '2500.00', description: 'Precio de venta al público configurado' })
    salePrice!: string;
}

export class StockAlertsMetaResponseDto {
    @ApiProperty({ example: 4 })
    total!: number;
}

export class StockAlertsResponseDto {
    @ApiProperty({ type: [StockAlertItemResponseDto] })
    data!: StockAlertItemResponseDto[];

    @ApiProperty({ type: StockAlertsMetaResponseDto })
    meta!: StockAlertsMetaResponseDto;
}
