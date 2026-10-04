import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    try {
      await this.dataSource.query('SELECT 1');
      this.logger.log('Conexion a la base de datos PostgreSQL 16 (Neon Serverless) OK');
    } catch (error) {
      this.logger.error(
        'Fallo al conectar a la base de datos',
        (error as Error).message,
      );
      throw error;
    }
  }
}
