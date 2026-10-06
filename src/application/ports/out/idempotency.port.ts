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

export interface AcquireIdempotencyParams {
    tenantId: string;
    key: string;
    operation: string;
    requestHash?: string;
    ttlSeconds?: number;
}

export interface AcquireIdempotencyResult<T = unknown> {
    acquired: boolean;
    completed: boolean;
    response?: T;
}

export interface IdempotencyPort {
    /**
     * Consulta el registro de una clave de idempotencia previa.
     */
    get<T>(tenantId: string, key: string): Promise<IdempotencyRecord<T> | null>;

    /**
     * Reserva atómicamente la clave para ejecución transaccional concurrente.
     * Si la clave ya está completada, retorna completed=true y response con el resultado previo.
     * Si está en ejecución por otra transacción o hilo, arroja IdempotencyConflictException.
     * Si no existía o expiró, inserta la clave en estado STARTED y retorna acquired=true.
     */
    acquire<T>(params: AcquireIdempotencyParams): Promise<AcquireIdempotencyResult<T>>;

    /**
     * Almacena el resultado exitoso de la operación bajo la clave dada.
     */
    save<T>(params: SaveIdempotencyParams<T>): Promise<void>;

    /**
     * Libera o marca como fallida la clave en caso de error para permitir reintentos posteriores.
     */
    release?(tenantId: string, key: string): Promise<void>;
}
