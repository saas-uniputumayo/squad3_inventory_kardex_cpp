import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InventoryApplicationModule } from './application/application.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { PresentationModule } from './presentation/presentation.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        InfrastructureModule,
        InventoryApplicationModule,
        PresentationModule,
    ],
})
export class AppModule {}
