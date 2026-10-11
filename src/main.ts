import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { InventoryExceptionFilter } from './presentation/filters/inventory-exception.filter';

import { ConfigService } from '@nestjs/config';

async function bootstrap() {
    const logger = new Logger('Bootstrap');
    const app = await NestFactory.create(AppModule);

    // Fail-fast on startup in production if JWT_SECRET is not configured
    const configService = app.get(ConfigService);
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret && process.env.NODE_ENV === 'production') {
        logger.error('FATAL: Variable de entorno JWT_SECRET no configurada en entorno de producción');
        process.exit(1);
    }

    // Global API versioned prefix
    app.setGlobalPrefix('api/v1');

    // Security & Validation: Strict global ValidationPipe
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: { enableImplicitConversion: false },
        }),
    );

    // Global centralized exception filter for inventory domain & application exceptions
    app.useGlobalFilters(new InventoryExceptionFilter());

    // CORS configuration
    const corsOrigins = process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
        : '*';

    app.enableCors({
        origin: corsOrigins,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
    });

    // Swagger OpenAPI Documentation
    const config = new DocumentBuilder()
        .setTitle('SaaS Contable - Inventory Engine (Squad 3)')
        .setDescription(
            'Multi-Tenant Inventory Engine, Multi-Warehouse, Kardex CPP & Stock Control API',
        )
        .setVersion('1.0')
        .addBearerAuth()
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    const port = process.env.PORT ?? 3001;
    await app.listen(port);
    logger.log(`Inventory Engine API running on port ${port} with prefix /api/v1`);
    logger.log(`OpenAPI documentation available at /api/docs`);
}

bootstrap().catch((err) => {
    console.error('Fatal bootstrap error:', err);
    process.exit(1);
});
