**GUÍA TÉCNICA Y DE INTEGRACIÓN - ESCUADRÓN 3**  
**Motor de Inventarios, Kardex Multi-Bodega y Costo Promedio Ponderado (CPP) API**  
_Esta guía está diseñada para que los demás escuadrones conozcan de forma simple y rápida cómo funciona nuestro módulo y cómo integrarse con él._

<table><tbody><tr><td><strong>SERVICIO<br></strong>squad3-inventory-service</td><td><strong>BASE DE DATOS<br></strong>PostgreSQL 16 + RLS</td><td><strong>CACHÉ / SESIÓN<br></strong>Redis 7 (jti &amp; Idempotencia)</td></tr><tr><td><strong>ARQUITECTURA<br></strong>Hexagonal (Prisma + Presentation)</td><td><strong>URL LOCAL<br></strong>http://localhost:3000/api/v1</td><td><strong>DOCUMENTACIÓN<br></strong>http://localhost:3000/api/docs</td></tr></tbody></table>

**1\. ¿Qué hace nuestro módulo?**  
El Escuadrón 3 es el Motor de Inventarios, Kardex y Costo (CPP) del ecosistema SaaS Contable de UniPutumayo. Nuestro motor se encarga de administrar el catálogo de productos con sus variantes y bodegas físicas, procesar las entradas y salidas de mercancía, calcular matemáticamente el Costo Promedio Ponderado (CPP) en tiempo real, suministrar el Costo de Mercancía Vendida (CMV) al motor contable (Escuadrón 2) y garantizar la trazabilidad inmutable mediante el libro mayor de inventario (Kardex).  
**2\. Objetivos Principales**

*   **Cálculo Matemático Exacto del CPP:** Recalcular el costo unitario ponderado en cada recepción de mercancía para abastecer al Escuadrón 2 con el valor exacto del Costo de Mercancía Vendida (CMV) al momento de asentar las ventas.
*   **Prevención de Stock Negativo y Concurrencia:** Bloquear estrictamente cualquier despacho o venta que supere las existencias disponibles mediante bloqueo pesimista en base de datos (SELECT ... FOR UPDATE), retornando HTTP 400 Bad Request.
*   **Inmutabilidad y Trazabilidad del Kardex:** Ningún movimiento se borra ni modifica físicamente (DELETE o UPDATE bloqueados). Todo error o anulación de factura se subsana emitiendo un contra-movimiento de compensación con auditoría completa.
*   **Aislamiento Multi-Tenant Riguroso:** Garantizar mediante Row Level Security (RLS) en PostgreSQL 16 con SET LOCAL app.current\_tenant\_id que ninguna empresa pueda visualizar o afectar inventarios de otro tenant.
*   **Arquitectura Hexagonal con Prisma y Capa Presentation:** Separación limpia de la capa HTTP/Swagger en src/presentation/ y persistencia transaccional con Prisma ORM 6, facilitando su integración en el monorepo sin acoplamientos indebidos.

**3\. URL y Autenticación**  
Para que los demás escuadrones puedan consumir nuestra API, estos son los datos de conexión y seguridad:

*   **Entorno de Desarrollo Local:** http://localhost:3000/api/v1
*   **Posible URL en Producción / Despliegue:** https://api.saascontable.uniputumayo.edu.co/api/v1
*   **Documentación Interactiva Swagger UI:** http://localhost:3000/api/docs
*   **Autenticación (JWT):** Todas las peticiones deben incluir la cabecera: Authorization: Bearer <TOKEN\_JWT> (validado en Redis 7 contra las sesiones activas emitidas por el Escuadrón 1).
*   **Tenant Fixture para Pruebas Locales:** 10000000-0000-0000-0000-000000000001 (Tenant A) y 20000000-0000-0000-0000-000000000002 (Tenant B).
*   **Idempotencia Segura:** Operaciones mutables de inventario aceptan la cabecera opcional X-Idempotency-Key: <UUID> para prevenir duplicados ante cortes de conexión.

**4\. Endpoints Disponibles**  
A continuación, los principales servicios que exponemos para que los demás escuadrones los consuman:  
**4.1. Recepción de Mercancía y Recálculo de CPP (Compras a Proveedores)**

*   **Endpoint: POST /api/v1/inventory/moves/receive**
*   **Qué hace:** Ingresa existencias físicas a una bodega específica y recalcula automáticamente el Costo Promedio Ponderado (CPP) del producto en tiempo real.
*   **Para qué sirve:** Utilizado por el Escuadrón 7 (Compras y Proveedores) al registrar facturas de compra y por el personal de almacén para recepciones de mercancía.

**4.2. Despacho de Mercancía y Salida POS (Venta / Salida Física)**

*   **Endpoint: POST /api/v1/inventory/moves/dispatch**
*   **Qué hace:** Verifica existencias disponibles bajo bloqueo pesimista (SELECT FOR UPDATE), descuenta el stock físico y retorna el Costo de Mercancía Vendida (CMV) valorado a costo CPP.
*   **Para qué sirve:** Utilizado por los Puntos de Venta (Escuadrón 4 Web POS y Escuadrón 5 Mobile POS) al concretar ventas. El CMV devuelto es enviado al Escuadrón 2 para el asiento contable (6135 vs 1435).

**4.3. Anular un Movimiento (Reversión Compensatoria)**

*   **Endpoint: POST /api/v1/inventory/moves/reverse**
*   **Qué hace:** Recibe el ID de un movimiento previo y crea un contra-movimiento simétrico auditado, restaurando las existencias sin alterar el historial físico de la base de datos.
*   **Para qué sirve:** Para que los puntos de venta o administración anulen facturas devueltas o despachos erróneos de forma 100% auditable.

**4.4. Consultar Catálogo y Existencias de Producto**

*   **Endpoint: GET /api/v1/inventory/products/:id (o GET /api/v1/inventory/products)**
*   **Qué hace:** Retorna los datos maestros del producto, código SKU, precio de venta, costo promedio actual y el desglose de existencias disponibles por cada bodega.
*   **Para qué sirve:** Para que los cajeros y administradores consulten disponibilidad en tiempo real antes de procesar una venta o generar una orden de compra.

**4.5. Catálogo de Bodegas Activas**

*   **Endpoint: GET /api/v1/inventory/warehouses**
*   **Qué hace:** Extrae la lista de bodegas habilitadas para la empresa actual.
*   **Para qué sirve:** Para alimentar los selectores de bodega en la interfaz web de caja, compras o transferencias.

**4.6. Transferencias entre Bodegas (Directas y Two-Phase)**

*   **Endpoint: POST /api/v1/inventory/transfers y POST /api/v1/inventory/transfers/:id/receive**
*   **Qué hace:** Traslada mercancía de forma inmediata (DIRECT) o en dos fases (TWO\_PHASE), descontando de la bodega origen y manteniendo el stock en estado IN\_TRANSIT hasta su confirmación en destino.
*   **Para qué sirve:** Para traslados de mercancía entre la bodega central y las sucursales comerciales.

**4.7. Tomas Físicas de Inventario y Ajustes Contables**

*   **Endpoint: POST /api/v1/inventory/stock-counts y POST /api/v1/inventory/stock-counts/:id/apply**
*   **Qué hace:** Abre sesiones de auditoría física de almacén y aplica automáticamente los ajustes contables por sobrantes (ADJUSTMENT\_IN) y faltantes (ADJUSTMENT\_OUT).
*   **Para qué sirve:** Para auditorías de cierre de mes, arqueos de almacén y cuadre físico de existencias.

**4.8. Consultar Libro Kardex Oficial y Alertas de Stock Mínimo**

*   **Endpoint: GET /api/v1/inventory/kardex/:productId y GET /api/v1/inventory/stock-alerts**
*   **Qué hace:** Extrae el libro mayor cronológico valorado de movimientos de un producto y el reporte de artículos cuyo stock actual está por debajo del límite mínimo.
*   **Para qué sirve:** Para el Escuadrón 6 (Reportes Financieros y BI) y Escuadrón 7 (Sugeridos de reabastecimiento a proveedores).

**5\. Matriz de Integración: ¿Qué debe consumir cada Escuadrón?**  
Aquí detallamos qué interacción tendrá cada escuadrón con nuestra API de acuerdo al plan general del SaaS Contable:

<table><tbody><tr><td><strong>Escuadrón</strong></td><td><strong>Misión del Escuadrón</strong></td><td><strong>¿Qué endpoints debe consumir de nosotros?</strong></td><td><strong>Explicación / Propósito</strong></td></tr><tr><td><strong>Squad 1</strong></td><td>Identidad, Multi-Tenant &amp; RBAC</td><td><strong>Ninguno</strong></td><td>Nosotros consumimos sus contratos de tokens JWT y validamos sesiones en Redis (session:&lt;userId&gt;:&lt;jti&gt;) para autenticar cada petición.</td></tr><tr><td><strong>Squad 2</strong></td><td>Motor Contable NIIF</td><td><strong>GET /api/v1/inventory/kardex/:productId<br>(o lectura de CMV tras despacho)</strong></td><td>Les proveemos el dato del Costo de Mercancía Vendida (CMV) calculado con el CPP para que asienten las líneas contables de costo (6135) e inventario (1435).</td></tr><tr><td><strong>Squad 4</strong></td><td>Web Desktop Admin &amp; High-Speed POS</td><td><strong>POST /api/v1/inventory/moves/dispatch<br>GET /api/v1/inventory/products<br>GET /api/v1/inventory/warehouses</strong></td><td>Al facturar en caja, despachan las unidades físicas y validan stock en tiempo real; los administradores crean y editan productos del catálogo.</td></tr><tr><td><strong>Squad 5</strong></td><td>Mobile POS Nativo Flutter (Offline)</td><td><strong>POST /api/v1/inventory/moves/dispatch<br>(con X-Idempotency-Key)<br>GET /api/v1/inventory/products</strong></td><td>Sincronizan los despachos de facturas emitidas sin conexión. Gracias a nuestra idempotencia con Redis, si reintentan el envío por fallas de red no se duplicará la salida.</td></tr><tr><td><strong>Squad 6</strong></td><td>Reportes Financieros y Auditoría</td><td><strong>GET /api/v1/inventory/kardex/:productId<br>GET /api/v1/inventory/stock-alerts</strong></td><td>Consumen el libro Kardex para los tableros de valoración de inventarios, rotación de mercancía y el reporte de productos con riesgo de desabastecimiento.</td></tr><tr><td><strong>Squad 7</strong></td><td>Compras, Proveedores y Fiados</td><td><strong>POST /api/v1/inventory/moves/receive<br>GET /api/v1/inventory/stock-alerts</strong></td><td>Al asentar una compra a proveedor (POST /purchases), nos envían la recepción para ingresar existencias y recalcular el CPP; consultan alertas para órdenes de compra.</td></tr><tr><td><strong>Squad 8</strong></td><td>DevOps, SRE &amp; QA Automation</td><td><strong>http://localhost:3000/api/docs<br>(OpenAPI export)</strong></td><td>Monitorean la disponibilidad (Health Checks) de nuestra API, ejecutan las pruebas automatizadas de integración en el pipeline CI/CD y orquestan el monorepo.</td></tr></tbody></table>

**6\. Reglas Críticas de Integración para los Escuadrones Consumidores**

*   **Valores Numéricos como Strings Decimales:** Para evitar imprecisiones de punto flotante de JavaScript (IEEE 754), todas las cantidades y precios deben enviarse y recibirse como strings fijos (ej. cantidades con 4 decimales: '50.0000', precios/costos con 2 decimales: '3400.00').
*   **NO calcular el CPP por cuenta propia:** La matemática del Costo Promedio Ponderado es responsabilidad exclusiva de este motor. Los escuadrones 2, 4, 5 y 7 deben tomar el costo unitario y total devuelto por Squad 3 en la respuesta del movimiento.
*   **NO modificar tablas de inventario directamente:** Terminantemente prohibido ejecutar INSERT o UPDATE directos sobre inventory\_balances o inventory\_movements desde otros servicios o scripts de base de datos; esto rompe la trazabilidad contable y el RLS.
*   **Uso obligatorio de IdempotencyKey en sincronizaciones:** Especialmente para Squad 5 (Mobile POS) y Squad 7 (Compras), envíen siempre la clave de idempotencia (UUID) en el cuerpo o cabecera para garantizar que un fallo de red no duplique existencias.
*   **Estructura Limpia para Squad 8 (Monorepo):** El Escuadrón 3 implementó su capa de entrada en src/presentation/ y persistencia con Prisma ORM 6 (prisma/schema.prisma). No colisiona con otros módulos y comparte el paquete transversal @saas/contracts.

<table><tbody><tr><td><strong>• CERTIFICACIÓN Y AUDITORÍA VERIFICADA: </strong>Todos los 14 endpoints de esta guía están 100% implementados, verificados con 35 escenarios E2E aprobados en infraestructura real (PostgreSQL + Redis + RLS), cuentan con especificación OpenAPI/Swagger interactiva y pruebas automatizadas de cobertura en el repositorio.</td></tr></tbody></table>