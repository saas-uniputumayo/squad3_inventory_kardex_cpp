import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DatabaseService } from './database.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
        const databaseUrl = configService.get<string>('DATABASE_URL');
        const isProduction =
          configService.get<string>('NODE_ENV') === 'production';
        const useSsl =
          configService.get<boolean>('DB_SSL') ??
          (Boolean(
            databaseUrl?.includes('render.com') ||
              databaseUrl?.includes('neon.tech') ||
              databaseUrl?.includes('sslmode=require')
          ) || isProduction);

        const sslOption = useSsl ? { rejectUnauthorized: false } : false;

        const baseConfig = {
          type: 'postgres' as const,
          ssl: sslOption,
          autoLoadEntities: true,
          synchronize: false,
          logging:
            configService.get<string>('NODE_ENV') !== 'production'
              ? (['error', 'warn'] as any)
              : (['error'] as any),
          extra: {
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
          },
        };

        if (databaseUrl) {
          return {
            ...baseConfig,
            url: databaseUrl,
          };
        }

        return {
          ...baseConfig,
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: configService.get<number>('DB_PORT', 5432),
          username: configService.get<string>('DB_USERNAME', 'saas_admin'),
          password: configService.get<string>('DB_PASSWORD', 'saas_secure_password_2026'),
          database: configService.get<string>('DB_DATABASE', 'saas_contable_db'),
        };
      },
    }),
  ],
  providers: [DatabaseService],
  exports: [DatabaseService, TypeOrmModule],
})
export class DatabaseModule {}
