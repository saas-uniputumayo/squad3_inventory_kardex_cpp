import { AsyncLocalStorage } from 'async_hooks';
import { QueryRunner } from 'typeorm';

export interface TenantStore {
  queryRunner: QueryRunner;
  tenantId?: string;
  userId?: string;
}

export class TenantContext {
  private static readonly storage = new AsyncLocalStorage<TenantStore>();

  static run(store: TenantStore, callback: () => Promise<void>): void {
    this.storage.run(store, callback);
  }

  static getQueryRunner(): QueryRunner | undefined {
    return this.storage.getStore()?.queryRunner;
  }

  static getTenantId(): string | undefined {
    return this.storage.getStore()?.tenantId;
  }

  static getUserId(): string | undefined {
    return this.storage.getStore()?.userId;
  }
}
