import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateStockCountDto {
    @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
    @IsUUID('4')
    @IsNotEmpty()
    warehouseId!: string;

    @ApiPropertyOptional({ example: 'Physical monthly inventory count' })
    @IsString()
    @IsOptional()
    notes?: string;

    @ApiPropertyOptional({
        type: [String],
        example: ['11111111-1111-4111-8111-111111111111'],
        description: 'Optional subset of product IDs to count. If omitted, all products in warehouse are included.',
    })
    @IsArray()
    @IsUUID('4', { each: true })
    @IsOptional()
    productIds?: string[];

    @ApiPropertyOptional({
        example: true,
        description: 'Whether to transition count status to IN_PROGRESS immediately upon creation',
        default: false,
    })
    @IsBoolean()
    @IsOptional()
    autoStart?: boolean;
}
