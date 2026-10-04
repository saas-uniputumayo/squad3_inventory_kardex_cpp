import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Observable, firstValueFrom } from 'rxjs';
import { DataSource, QueryRunner } from 'typeorm';
import { TenantContext } from './tenant-context';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantInterceptor.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const tenantId: string = user?.tenantId || request.headers['x-tenant-id'];

    if (!tenantId || !UUID_REGEX.test(tenantId)) {
      throw new UnauthorizedException('tenantId ausente o con formato UUID invalido.');
    }

    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query('SELECT set_current_tenant($1)', [tenantId]);
    } catch {
      try {
        await queryRunner.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
      } catch (err: any) {
        await this.safeRollbackAndRelease(queryRunner);
        throw new UnauthorizedException(`Error estableciendo contexto de tenant: ${err.message}`);
      }
    }

    request.queryRunner = queryRunner;

    return new Observable((subscriber) => {
      TenantContext.run(
        { queryRunner, tenantId, userId: user?.userId },
        async () => {
          try {
            const result = await firstValueFrom(next.handle());
            if (!queryRunner.isReleased) {
              await queryRunner.commitTransaction();
            }
            subscriber.next(result);
            subscriber.complete();
          } catch (error) {
            if (!queryRunner.isReleased) {
              await queryRunner.rollbackTransaction();
            }
            subscriber.error(error);
          } finally {
            if (!queryRunner.isReleased) {
              await queryRunner.release();
            }
          }
        },
      );
    });
  }

  private async safeRollbackAndRelease(queryRunner: QueryRunner): Promise<void> {
    if (!queryRunner.isReleased) {
      try {
        await queryRunner.rollbackTransaction();
      } finally {
        await queryRunner.release();
      }
    }
  }
}
