export enum IdempotencyStatus {
    STARTED = 'STARTED',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
}

export interface IdempotencyRecord<T = unknown> {
    key: string;
    tenantId: string;
    operation: string;
    status: IdempotencyStatus;
    response?: T;
    resourceId?: string;
    createdAt: Date;
}

export interface SaveIdempotencyParams<T = unknown> {
    tenantId: string;
    key: string;
    operation: string;
    response: T;
    resourceId?: string;
    ttlSeconds?: number;
}

export interface IdempotencyPort {
    /**
     * Consulta el registro de una clave de idempotencia previa.
     */
    get<T>(tenantId: string, key: string): Promise<IdempotencyRecord<T> | null>;

    /**
     * Almacena el resultado exitoso de la operación bajo la clave dada.
     */
    save<T>(params: SaveIdempotencyParams<T>): Promise<void>;

    /**
     * Libera o marca como fallida la clave en caso de error para permitir reintentos posteriores.
     */
    release?(tenantId: string, key: string): Promise<void>;
}
