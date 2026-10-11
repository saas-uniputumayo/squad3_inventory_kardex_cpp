import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantStore {
    tenantId: string;
    userId?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<TenantStore>();

export const TenantContext = {
    /**
     * Ejecuta una función asíncrona dentro del almacén contextual del tenant.
     */
    run<T>(store: TenantStore, callback: () => Promise<T>): Promise<T> {
        return asyncLocalStorage.run(store, callback);
    },

    /**
     * Obtiene el identificador del tenant actual en el contexto de ejecución.
     */
    getTenantId(): string | undefined {
        return asyncLocalStorage.getStore()?.tenantId;
    },

    /**
     * Obtiene el identificador del usuario autenticado en el contexto actual.
     */
    getUserId(): string | undefined {
        return asyncLocalStorage.getStore()?.userId;
    },

    /**
     * Retorna todo el almacén actual.
     */
    getStore(): TenantStore | undefined {
        return asyncLocalStorage.getStore();
    },
};
