import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

export class CountLineDto {
    @ApiProperty({ example: '77777777-7777-4777-8777-777777777777' })
    @IsUUID('4')
    @IsNotEmpty()
    lineId!: string;

    @ApiProperty({ example: '12.0000', description: 'Actual physical counted quantity' })
    @IsString()
    @IsNotEmpty()
    countedQuantity!: string;

    @ApiPropertyOptional({ example: 'Verified double count' })
    @IsString()
    @IsOptional()
    notes?: string;
}

export class ApplyStockCountDto {
    @ApiPropertyOptional({
        type: [CountLineDto],
        description: 'Optional count line updates prior to applying and posting adjustments',
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CountLineDto)
    @IsOptional()
    counts?: CountLineDto[];
}
