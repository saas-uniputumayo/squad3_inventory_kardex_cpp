import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

// Application & Infrastructure Modules
import { InventoryApplicationModule } from '../application/application.module';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';

// Presentation Controllers
import { ProductsController } from './controllers/inventory/products.controller';
import { WarehousesController } from './controllers/inventory/warehouses.controller';
import { InventoryMovementsController } from './controllers/inventory/inventory-movements.controller';
import { TransfersController } from './controllers/inventory/transfers.controller';
import { KardexController } from './controllers/inventory/kardex.controller';
import { StockAlertsController } from './controllers/inventory/stock-alerts.controller';
import { StockCountsController } from './controllers/inventory/stock-counts.controller';

// Guards, Interceptors, Filters
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { TenantInterceptor } from './interceptors/tenant.interceptor';
import { InventoryExceptionFilter } from './filters/inventory-exception.filter';

@Module({
    imports: [
        InventoryApplicationModule,
        InfrastructureModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
                const secret =
                    configService.get<string>('JWT_SECRET') ||
                    process.env.JWT_SECRET;

                if (!secret && process.env.NODE_ENV === 'production') {
                    throw new Error('FATAL: JWT_SECRET environment variable is missing in production');
                }

                return {
                    secret: secret || 'uniputumayo-saas-dev-secret-key-2026',
                    signOptions: {
                        expiresIn: (configService.get<string>('JWT_EXPIRATION') || '8h') as any,
                    },
                };
            },
        }),
    ],
    controllers: [
        ProductsController,
        WarehousesController,
        InventoryMovementsController,
        TransfersController,
        KardexController,
        StockAlertsController,
        StockCountsController,
    ],
    providers: [
        JwtAuthGuard,
        RolesGuard,
        TenantInterceptor,
        InventoryExceptionFilter,
    ],
    exports: [
        JwtAuthGuard,
        RolesGuard,
        TenantInterceptor,
        InventoryExceptionFilter,
        InventoryApplicationModule,
    ],
})
export class PresentationModule {}
