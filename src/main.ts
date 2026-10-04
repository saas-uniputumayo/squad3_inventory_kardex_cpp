import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('InventoryBootstrap');
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SaaS Contable - API Inventarios Multi-Bodega y Kardex CPP (Escuadron 3)')
    .setDescription(
      'API de gestion integral de inventario multisede, traslados inter-bodega y Kardex valorizado bajo Costo Promedio Ponderado (CPP). ' +
      'Garantiza concurrencia pesimista (SELECT FOR UPDATE), cero stock negativo y provee el costo de ventas en tiempo real para causacion NIIF.'
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : '*';

  app.enableCors({
    origin: corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  const port = process.env.PORT || 3003;
  await app.listen(port);
  logger.log(`Servidor de Inventarios y Kardex CPP iniciado y escuchando en el puerto ${port}`);
  logger.log(`Documentacion interactiva Swagger disponible en http://localhost:${port}/api/docs`);
}

bootstrap();
