# SaaS Contable UniPutumayo — Motor de Inventarios y Kardex CPP (Squad 3)

> **Backend Core de Inventarios Multi-Bodega, Costo Promedio Ponderado (CPP), Tomas Físicas, Idempotencia y Kardex Valorizado Inmutable**  
> Desarrollado con **NestJS 11**, **TypeScript 5.5**, **Prisma ORM 6.19**, **PostgreSQL 16+ (Multi-Tenant RLS)** y **Redis 7+**.

---

## 1. PRESENTACIÓN Y ALCANCE

El **Motor de Inventarios (Squad 3)** es el subsistema central encargado de la custodia física, matemática y contable de los inventarios dentro del ERP SaaS multi-tenant de la Universidad de la Amazonia / UniPutumayo.

### Problema Funcional que Resuelve
En entornos comerciales y de puntos de venta (POS) de alta concurrencia, los errores de sincronización de inventario, la falta de control en traslados entre bodegas y las discrepancias de redondeo en costos de compra provocan distorsiones en los estados financieros y pérdidas económicas. Este motor resuelve:
1. **Valuación Continua:** Cálculo en tiempo real del Costo Promedio Ponderado (CPP) por producto y bodega, asegurando una valoración fiscal precisa para la contabilidad general.
2. **Kardex Inmutable:** Registro secuencial de cada entrada, salida y ajuste en el Libro Mayor de Inventario (`inventory_ledger_entries`), garantizando trazabilidad cronológica total.
3. **Control Multi-Bodega Concurrente:** Prevención estricta de existencias negativas ante múltiples cajas registradoras simultáneas mediante transacciones ACID y bloqueos pesimistas (`SELECT FOR UPDATE`).
4. **Aislamiento Multi-Tenant de Grado Bancario:** Protección de datos a nivel de motor de base de datos con PostgreSQL Row Level Security (RLS).
5. **Idempotencia Distribuida:** Eliminación de dobles despachos o dobles recepciones generados por reintentos de red o fallas de conectividad.

### Relación con el ERP SaaS y Otras Squads
- **Squad 1 (Core & RBAC):** Provee la autenticación transversal JWT, gestión de identidades y validación de sesiones en Redis.
- **Squad 2 (POS & Facturación):** Consume el endpoint de despacho `/moves/dispatch` al registrar ventas de mostrador y consulta disponibilidad de existencias.
- **Squad 4 (Módulo de Compras):** Consume `/moves/receive` para dar entrada a mercancías compradas a proveedores e impactar el costo promedio ponderado.
- **Squad 5 (Contabilidad & Reportes):** Consume `/kardex/:productId` para conciliar el costo de ventas y generar balances fiscales periódicos.

---

## 2. FUNCIONALIDADES IMPLEMENTADAS

- **Catálogo de Productos y Variantes:** Gestión de productos simples y variables con SKU único por tenant, código de barras y asociación a categorías.
- **Unidades de Medida Canónicas:** Soporte para unidades de tipo unidad (`UNIT`), peso (`WEIGHT`), longitud (`LENGTH`) y volumen (`VOLUME`), con validación de decimales permitidos.
- **Administración Multi-Bodega:** Configuración de múltiples bodegas físicas vinculadas a sucursales (`branches`) con estados operativos activo/inactivo/archivado.
- **Recepción de Mercancía (`PURCHASE_RECEIPT`):** Entrada física con recálculo matemático automático de CPP.
- **Despacho de Mercancía (`SALE_DISPATCH`):** Salida de inventario valorizada al CPP vigente con validación de stock disponible.
- **Reversión Compensatoria (`REVERSE`):** Anulación formal de movimientos mediante contra-asiento en Kardex y restauración de saldos, sin eliminar registros históricos.
- **Transferencias Multi-Bodega:**
  - *Directas Atómicas:* Salida de origen y entrada en destino en una única transacción atómica.
  - *En Dos Fases (Two-Phase):* Salida de origen hacia estado `IN_TRANSIT` y recepción explícita posterior en bodega destino.
- **Tomas Físicas de Inventario (`Stock Counts`):** Apertura de sesiones de auditoría, captura de conteos físicos y aplicación automatizada de ajustes por faltante (`ADJUSTMENT_OUT`) o sobrante (`ADJUSTMENT_IN`).
- **Alertas de Stock Mínimo:** Monitoreo dinámico de productos cuyas existencias caigan en o por debajo de su umbral de seguridad configurado.
- **Idempotencia Transaccional:** Registro y cacheo de operaciones mediante cabecera `Idempotency-Key` en PostgreSQL y Redis.
- **Aislamiento Multi-Tenant Estricto:** Políticas RLS en PostgreSQL activadas por conexión mediante `set_current_tenant()`.

---

## 3. ARQUITECTURA DEL SOFTWARE (HEXAGONAL + DDD)

El proyecto implementa una arquitectura hexagonal pura (Puertos y Adaptadores) con separación estricta de responsabilidades:

```
src/
├── domain/                      # 1. DOMINIO (Cero dependencias externas / TypeScript puro)
│   ├── entities/                # Agregados y Entidades (Product, Balance, Movement, Transfer, etc.)
│   ├── value-objects/           # Objetos de Valor inmutables (Quantity, UnitCost, Money, Sku)
│   ├── policy/                  # Políticas de negocio (PrecisionPolicy: 6 decimales costo, 4 COP)
│   ├── exceptions/              # Excepciones semánticas de dominio
│   └── types/                   # Tipos y enumeraciones canónicas
├── application/                 # 2. APLICACIÓN (Casos de uso y orquestación)
│   ├── ports/
│   │   ├── in/                  # Puertos de Entrada (Interfaces de casos de uso)
│   │   └── out/                 # Puertos de Salida (Interfaces de repositorios y UoW)
│   ├── services/                # Implementación de casos de uso (ReceiveStockService, etc.)
│   └── exceptions/              # Excepciones de aplicación (ResourceNotFound, Conflict, etc.)
├── infrastructure/              # 3. INFRAESTRUCTURA (Adaptadores de salida y persistencia)
│   ├── persistence/prisma/      # Adaptador Prisma ORM PostgreSQL
│   │   ├── repositories/        # Implementación de puertos de salida (PrismaProductRepository, etc.)
│   │   ├── unit-of-work/        # PrismaUnitOfWork con transacciones interactivas y locks
│   │   └── mappers/             # Mappers bidireccionales Prisma <-> Dominio
│   ├── auth/                    # Adaptadores de validación de sesiones en Redis
│   ├── context/                 # TenantContext y ejecución RLS
│   └── idempotency/             # Adaptador de persistencia de claves de idempotencia
└── presentation/                # 4. PRESENTACIÓN (Adaptador inbound HTTP / REST)
    ├── controllers/             # Controladores NestJS documentados con Swagger
    ├── dto/                     # Data Transfer Objects con validación estricta class-validator
    ├── filters/                 # Centralized InventoryExceptionFilter
    ├── guards/                  # JwtAuthGuard y RolesGuard (RBAC)
    └── interceptors/            # TenantInterceptor (inyección de contexto tenant en PostgreSQL)
```

### Diagrama de Arquitectura Hexagonal

```mermaid
graph TD
    subgraph Presentation["Capa Presentation (Inbound Adapter)"]
        HTTP[HTTP Client / POS / Web] -->|JSON + Bearer JWT| Controller[NestJS Controllers]
        Controller -->|DTO Validado| Pipe[ValidationPipe]
        Controller -->|set_current_tenant| Interceptor[TenantInterceptor]
        Controller -->|Verifica jti| AuthGuard[JwtAuthGuard & RolesGuard]
    end

    subgraph Application["Capa Application (Use Cases)"]
        Controller -->|Invoke| InPort[Input Ports / Interfaces]
        InPort --> UseCase[Application Services]
        UseCase -->|Coordina transacciones| UoWPort[UnitOfWork Port]
        UseCase -->|Lectura / Escritura| OutPort[Repository Ports]
    end

    subgraph Domain["Capa Domain (Core Enterprise Logic)"]
        UseCase --> Aggregate[Domain Entities & Aggregates]
        Aggregate --> VO[Value Objects & PrecisionPolicy]
        Aggregate --> Rules[CPP Formula, Invariants & Negative Stock Guard]
    end

    subgraph Infrastructure["Capa Infrastructure (Outbound Adapters)"]
        UoWPort --> PrismaUoW[PrismaUnitOfWork]
        OutPort --> PrismaRepo[Prisma Repositories]
        AuthGuard --> RedisCache[Redis Session Adapter]
        PrismaUoW -->|SELECT FOR UPDATE| PostgreSQL[(PostgreSQL 16 + RLS)]
        PrismaRepo --> PostgreSQL
        RedisCache --> RedisDB[(Redis 7)]
    end
```

### Diagrama de Secuencia: Recepción de Inventario (`POST /moves/receive`)

```mermaid
sequenceDiagram
    autonumber
    actor Client as Consumidor (Compras / Web)
    participant Ctrl as InventoryMovementsController
    participant Guard as JwtAuthGuard & RolesGuard
    participant Interceptor as TenantInterceptor
    participant Service as ReceiveStockService
    participant UoW as PrismaUnitOfWork
    participant Domain as InventoryBalance (Domain)
    participant DB as PostgreSQL (RLS)

    Client->>Ctrl: POST /api/v1/inventory/moves/receive (Bearer Token + DTO)
    Ctrl->>Guard: Validar Token JWT + Sesión en Redis (jti)
    Guard-->>Ctrl: Autorizado (OWNER / ADMIN / WAREHOUSE_MANAGER)
    Ctrl->>Interceptor: Ejecutar TenantInterceptor
    Interceptor->>DB: SELECT set_current_tenant('tenant-uuid')
    Ctrl->>Service: execute(ReceiveStockCommand)
    Service->>UoW: executeInTransaction(callback)
    UoW->>DB: BEGIN TRANSACTION
    UoW->>DB: SELECT * FROM inventory_balances WHERE ... FOR UPDATE
    DB-->>UoW: Balance Actual (Stock Previo, CPP Previo)
    UoW->>Domain: receiveStock(quantity, unitCost)
    Domain->>Domain: Recalcular CPP Continuo y Nuevo Saldo
    UoW->>DB: INSERT INTO inventory_movements ... (POSTED)
    UoW->>DB: INSERT INTO inventory_movement_lines ...
    UoW->>DB: INSERT INTO inventory_ledger_entries ... (Kardex Entry)
    UoW->>DB: UPDATE inventory_balances SET quantity_on_hand, average_cost ...
    UoW->>DB: COMMIT TRANSACTION
    Service-->>Ctrl: ReceiveStockResponseDto
    Ctrl-->>Client: 201 Created (movementId, newStock, newAverageCost)
```

### Diagrama de Secuencia: Reversión de Movimiento (`POST /moves/reverse`)

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Administrador (OWNER / ADMIN)
    participant Ctrl as InventoryMovementsController
    participant Service as ReverseMovementService
    participant UoW as PrismaUnitOfWork
    participant DB as PostgreSQL (RLS)

    Admin->>Ctrl: POST /api/v1/inventory/moves/reverse (movementId, reason)
    Ctrl->>Service: execute(ReverseMovementCommand)
    Service->>UoW: executeInTransaction(callback)
    UoW->>DB: SELECT * FROM inventory_movements WHERE id = movementId FOR UPDATE
    Note over UoW,DB: Validar que el movimiento existe y NO ha sido revertido previamente
    UoW->>DB: SELECT * FROM inventory_balances ... FOR UPDATE
    Note over Service,UoW: Generar movimiento compensatorio de tipo opuesto
    UoW->>DB: INSERT INTO inventory_movements (status = POSTED, reversesMovementId = movementId)
    UoW->>DB: INSERT INTO inventory_ledger_entries (Contra-asiento de Kardex)
    UoW->>DB: UPDATE inventory_movements SET status = REVERSED WHERE id = movementId
    UoW->>DB: UPDATE inventory_balances (Restaurar saldo previo)
    UoW->>DB: COMMIT TRANSACTION
    Service-->>Ctrl: ReverseMovementResponseDto
    Ctrl-->>Admin: 200 OK (reversedMovementId, reversalMovementId, newStock)
```

---

## 4. REQUISITOS PREVIOS DEL SISTEMA

| Componente | Versión Verificada | Propósito |
|---|---|---|
| **Node.js** | `>= 20.14.0` (Probado en `v24.16.0`) | Entorno de ejecución JavaScript / TypeScript |
| **npm** | `>= 10.0.0` | Gestor de paquetes |
| **PostgreSQL** | `>= 16.0` | Base de datos relacional con soporte RLS |
| **Redis** | `>= 7.0` | Almacenamiento en memoria de sesiones (`jti`) y caché |
| **Prisma ORM** | `6.19.3` | Generador de esquemas, migraciones y cliente tipado |
| **NestJS** | `11.0.0` | Framework modular del backend |

---

## 5. INSTALACIÓN Y CONFIGURACIÓN LOCAL

### 5.1. Clonar e Instalar Dependencias
```bash
git clone https://github.com/saas-uniputumayo/squad3_inventory_kardex_cpp.git
cd squad3_inventory_kardex_cpp/apps/api
npm install
```

### 5.2. Configuración de Variables de Entorno (`.env`)
Crear un archivo `.env` en la raíz de `apps/api` con la siguiente estructura (nunca incluir credenciales de producción):

```env
# Configuración del Servidor
PORT=3000
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Base de Datos PostgreSQL con RLS
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/saas_contable_db?schema=public"

# Servidor Redis para Sesiones e Idempotencia
REDIS_URL="redis://localhost:6379"

# Seguridad y Autenticación JWT transversal
JWT_SECRET="super_secret_jwt_key_uniputumayo_2026_opcion_grado"
JWT_EXPIRATION="8h"
```

### 5.3. Preparar Base de Datos y Semillero de Auditoría
```bash
# Validar el esquema Prisma
npm run prisma:validate

# Generar el cliente de Prisma
npm run prisma:generate

# Ejecutar el semillero reproducible de prueba multi-tenant
npm run db:seed
```

### 5.4. Iniciar el Servidor
```bash
# Modo desarrollo con recarga automática
npm run dev

# Compilación y ejecución de producción
npm run build
npm run start
```

La API estará disponible en `http://localhost:3000/api/v1`.  
La documentación interactiva de Swagger UI estará accesible en `http://localhost:3000/api/docs`.

---

## 6. AUTENTICACIÓN, SESIONES Y SEGURIDAD MULTI-TENANT

### 6.1. Esquema de Autenticación JWT + `jti` + Redis
Todo consumo de la API requiere enviar un token Bearer en el encabezado:
```http
Authorization: Bearer <jwt-token>
```

El token debe incluir obligatoriamente los siguientes claims:
- `sub`: Identificador UUID del usuario autenticado.
- `tenantId`: Identificador UUID del tenant actual.
- `role`: Rol del usuario (`OWNER`, `ADMIN`, `ACCOUNTANT`, `WAREHOUSE_MANAGER`, `CASHIER`).
- `jti`: Identificador UUID único de la sesión activa.

En cada solicitud entrante, `JwtAuthGuard`:
1. Verifica criptográficamente la firma del token usando `JWT_SECRET`.
2. Extrae `sub` y `jti`.
3. Consulta Redis para comprobar que la clave `session:${sub}:${jti}` exista y esté en estado `active`.
4. Si la clave no existe (por expiración o logout revocado), retorna de inmediato `401 Unauthorized`.

### 6.2. Roles y Matriz de Permisos (RBAC)

| Endpoint | Rol OWNER | Rol ADMIN | Rol ACCOUNTANT | Rol WAREHOUSE_MANAGER | Rol CASHIER |
|---|:---:|:---:|:---:|:---:|:---:|
| `POST /products` (Crear Producto) | ✅ | ✅ | ❌ (403) | ✅ | ❌ (403) |
| `PATCH /products/:id` (Modificar Producto) | ✅ | ✅ | ❌ (403) | ✅ | ❌ (403) |
| `GET /products` (Buscar Productos) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /warehouses` (Listar Bodegas) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /moves/receive` (Recibir Stock) | ✅ | ✅ | ❌ (403) | ✅ | ❌ (403) |
| `POST /moves/dispatch` (Despachar Stock POS) | ✅ | ✅ | ❌ (403) | ✅ | ✅ |
| `POST /moves/reverse` (Revertir Movimiento) | ✅ | ✅ | ❌ (403) | ❌ (403) | ❌ (403) |
| `POST /transfers` (Iniciar Traslado) | ✅ | ✅ | ❌ (403) | ✅ | ❌ (403) |
| `POST /transfers/:id/receive` (Recibir Traslado) | ✅ | ✅ | ❌ (403) | ✅ | ❌ (403) |
| `POST /stock-counts` (Crear Conteo Físico) | ✅ | ✅ | ❌ (403) | ✅ | ❌ (403) |
| `POST /stock-counts/:id/apply` (Aplicar Ajuste) | ✅ | ✅ | ❌ (403) | ✅ | ❌ (403) |
| `GET /kardex/:productId` (Consultar Kardex) | ✅ | ✅ | ✅ | ✅ | ❌ (403) |
| `GET /stock-alerts` (Consultar Alertas) | ✅ | ✅ | ✅ | ✅ | ❌ (403) |

---

## 7. MATRIZ DE ENDPOINTS Y CONTRATOS HTTP

Todos los endpoints retornan respuestas formateadas en JSON y manejan errores de acuerdo con el esquema estándar `ErrorResponseDto`.

| # | Método | Ruta Completa | Caso de Uso | Códigos HTTP |
|:---:|:---:|:---|---|:---:|
| 1 | `POST` | `/api/v1/inventory/products` | Registro de producto en catálogo | `201`, `400`, `401`, `403`, `409` |
| 2 | `PATCH` | `/api/v1/inventory/products/:id` | Actualización de datos y precios | `200`, `400`, `401`, `403`, `404` |
| 3 | `GET` | `/api/v1/inventory/products` | Búsqueda y listado paginado | `200`, `401`, `403` |
| 4 | `GET` | `/api/v1/inventory/products/:id` | Detalle con existencias por bodega | `200`, `401`, `403`, `404` |
| 5 | `GET` | `/api/v1/inventory/warehouses` | Listado de bodegas asignadas | `200`, `401`, `403` |
| 6 | `POST` | `/api/v1/inventory/moves/receive` | Recepción de mercancía y recálculo CPP | `201`, `400`, `401`, `403`, `404`, `409` |
| 7 | `POST` | `/api/v1/inventory/moves/dispatch` | Despacho de mercancía valorizada a CPP | `201`, `400`, `401`, `403`, `404`, `409` |
| 8 | `POST` | `/api/v1/inventory/moves/reverse` | Reversión y contra-asiento de Kardex | `200`, `400`, `401`, `403`, `404`, `409` |
| 9 | `POST` | `/api/v1/inventory/transfers` | Traslado directo o two-phase | `201`, `400`, `401`, `403`, `404`, `409` |
| 10 | `POST` | `/api/v1/inventory/transfers/:id/receive` | Confirmación de recepción en destino | `200`, `400`, `401`, `403`, `404`, `409` |
| 11 | `POST` | `/api/v1/inventory/stock-counts` | Apertura de sesión de toma física | `201`, `400`, `401`, `403`, `404` |
| 12 | `POST` | `/api/v1/inventory/stock-counts/:id/apply` | Asentar ajustes físicos en balances | `200`, `400`, `401`, `403`, `404`, `409` |
| 13 | `GET` | `/api/v1/inventory/kardex/:productId` | Historial oficial del libro mayor | `200`, `401`, `403`, `404` |
| 14 | `GET` | `/api/v1/inventory/stock-alerts` | Consulta de existencias bajo umbral | `200`, `401`, `403` |

Para el detalle exhaustivo de payloads JSON, ejemplos de petición/respuesta y reglas para equipos externos, consulte [`README_INTEGRACION_SQUAD3.md`](./README_INTEGRACION_SQUAD3.md).

---

## 8. REGLAS DE NEGOCIO Y PRECISIÓN NUMÉRICA

### 8.1. Valuación Continua por Costo Promedio Ponderado (CPP)
El costo promedio ponderado unitario se recalcula de forma continua exclusivamente ante **entradas de stock** con costo de adquisición:
$$\text{CPP}_{\text{nuevo}} = \frac{(\text{Stock}_{\text{previo}} \times \text{CPP}_{\text{previo}}) + (\text{Cantidad}_{\text{entrada}} \times \text{Costo}_{\text{unitario}})}{\text{Stock}_{\text{previo}} + \text{Cantidad}_{\text{entrada}}}$$

- Los despachos y salidas **no alteran el CPP unitario**; descargan el valor total del inventario proporcionalmente: $\Delta \text{Valor} = \text{Cantidad} \times \text{CPP}$.
- Si el stock previo es $0$, el nuevo CPP es idéntico al costo unitario recibido.

### 8.2. Precisión Decimal y Redondeo
El dominio implementa la política `PrecisionPolicy`:
- **Cantidades:** Hasta 6 decimales. Controlado según la unidad de medida (ej. unidades enteras tienen `decimalPlaces = 0`; kilogramos tienen `decimalPlaces = 4`).
- **Costos Unitarios:** Exactitud de 6 decimales (`Decimal(18, 6)` en base de datos).
- **Valores Monetarios:** Exactitud de 4 decimales (`Decimal(20, 4)` en base de datos) para compatibilidad con la moneda COP y liquidaciones fiscales.
- **Redondeo:** `ROUND_HALF_UP` aplicado en divisiones.

### 8.3. Invariante de Stock Disponible
El motor prohíbe que el saldo físico de cualquier bodega resulte negativo. En cada despacho:
$$\text{Cantidad a Despachar} \le \text{Cantidad en Existencia} - \text{Cantidad Reservada}$$
Si esta condición no se satisface, la transacción se aborta arrojando `InvalidInventoryBalanceException` (`400 Bad Request`).

---

## 9. MODELO DE DATOS Y ENTIDADES RELACIONALES

```mermaid
erDiagram
    TENANT ||--o{ PRODUCT : owns
    TENANT ||--o{ WAREHOUSE : owns
    TENANT ||--o{ INVENTORY_BALANCE : owns
    TENANT ||--o{ INVENTORY_MOVEMENT : owns
    TENANT ||--o{ INVENTORY_LEDGER_ENTRY : owns
    TENANT ||--o{ INVENTORY_TRANSFER : owns
    TENANT ||--o{ STOCK_COUNT : owns

    PRODUCT ||--|{ PRODUCT_VARIANT : has
    PRODUCT ||--|| UNIT_OF_MEASURE : measures
    PRODUCT_VARIANT ||--o{ INVENTORY_BALANCE : balances
    WAREHOUSE ||--o{ INVENTORY_BALANCE : stores

    INVENTORY_MOVEMENT ||--|{ INVENTORY_MOVEMENT_LINE : contains
    INVENTORY_MOVEMENT ||--o{ INVENTORY_LEDGER_ENTRY : posts
    INVENTORY_MOVEMENT ||--o| INVENTORY_MOVEMENT : reverses

    INVENTORY_TRANSFER ||--|{ INVENTORY_TRANSFER_LINE : contains
    INVENTORY_TRANSFER ||--o| INVENTORY_MOVEMENT : outbound
    INVENTORY_TRANSFER ||--o| INVENTORY_MOVEMENT : inbound

    STOCK_COUNT ||--|{ STOCK_COUNT_LINE : contains
```

---

## 10. DATOS DE DEMOSTRACIÓN (`prisma/seed.ts`)

La semilla oficial `prisma/seed.ts` crea datos deterministas y reproducibles para dos organizaciones completamente separadas:

### Tenant A (`AUDIT Tenant A` - Régimen Simple)
- **Sucursal:** `Branch A1` (Mocoa Centro).
- **Bodegas:** `Bodega Principal A1` (`WAR-A1`, activa) y `Bodega Secundaria A2` (`WAR-A2`, activa).
- **Usuarios de Prueba:**
  - `owner.a@audit.co` (`OWNER`)
  - `admin.a@audit.co` (`ADMIN`)
  - `accountant.a@audit.co` (`ACCOUNTANT`)
  - `warehouse.a@audit.co` (`WAREHOUSE_MANAGER`)
  - `cashier.a@audit.co` (`CASHIER`)
  - *Contraseña estándar de prueba local:* `AuditPassword2026*`
- **Catálogo Inicial y Existencias:**
  - `ARR-001` (Arroz 1kg): 100 kg en A1 a $4,000 COP CPP. 0 kg en A2.
  - `ACE-001` (Aceite 1L): 50 unidades en A1 a $8,000 COP CPP.
  - `CAB-001` (Cable eléctrico): 200 metros en A1 a $2,500 COP CPP.
  - `CEM-001` (Cemento 50kg): 4 bultos en A1 a $28,000 COP CPP.
  - `TAL-001` (Taladro Percutor): 0 unidades (prueba de stock agotado).
  - `SRV-001` (Servicio de Mantenimiento): Tipo `SERVICE` (no inventariable).

### Tenant B (`AUDIT Tenant B` - Responsable IVA)
- **Sucursal:** `Branch B1`.
- **Bodega:** `Bodega Central Tenant B` (`WAR-B1`).
- **Usuarios:** `owner.b@audit.co`, `cashier.b@audit.co`.
- **Catálogo:** `VAR-B01` (Varilla Corrugada Diaco, 50 unidades a $30,000 COP). Totalmente aislado de Tenant A.

---

## 11. PRUEBAS AUTOMATIZADAS Y AUDITORÍA DE CALIDAD

El motor cuenta con una suite integral de pruebas que certifican el 100% de la funcionalidad del sistema:

```bash
# 1. Ejecutar pruebas unitarias, de integración y arquitectura
npm test

# 2. Ejecutar auditoría funcional E2E contra base de datos y Redis reales
npm run test:e2e

# 3. Validar cobertura completa de endpoints en Swagger OpenAPI
npm run test:swagger

# 4. Exportar el contrato OpenAPI canónico a docs/openapi.json y swagger.json
npm run openapi:export

# 5. Verificación estricta de compilación y tipado
npx tsc --noEmit
npm run build
```

### Resultados de la Auditoría Técnica Certificada
```text
===================================================================
               ESTADO: FUNCTIONALLY VERIFIED (100% GREEN)
===================================================================
- Pruebas Unitarias e Integración:  241 / 241 PASADAS (29 suites)
- Auditoría Funcional E2E:          35 / 35 PASADAS (PostgreSQL + Redis)
- Cobertura de Endpoints OpenAPI:   14 / 14 ENDPOINTS AUDITADOS
- Compilación NestJS:              0 ERRORES (Código limpio en dist/)
- Verificación TypeScript:          0 ERRORES (npx tsc --noEmit limpio)
- Esquema Prisma:                   VÁLIDO (npx prisma validate limpio)
===================================================================
```

---

## 12. LIMITACIONES Y EVOLUCIÓN FUTURA

1. **Gestión de Lotes y Vencimientos:** El modelo actual maneja CPP global por producto y bodega. La trazabilidad por lote individual (`lotNumber`) y fecha de caducidad está planificada para la fase 3.
2. **Números de Serie Individuales:** El inventario serializado (dispositivos electrónicos con IMEI o serial único) se encuentra actualmente fuera de alcance.
3. **Distribución Multi-Región Activa:** La atomicidad de transferencias depende de PostgreSQL local. No se cuenta con replicación bidireccional multirregión con particionamiento de red activo.

---
*Documentación oficial certificada del Squad 3 — ERP SaaS Contable UniPutumayo.*
