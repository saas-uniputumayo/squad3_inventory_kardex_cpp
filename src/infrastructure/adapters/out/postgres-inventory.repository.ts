import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import {
  InventoryRepositoryPort,
  KardexReport,
  ProductStockOverview,
} from '../../../core/domain/ports/outbound/inventory-repository.port';
import { Product } from '../../../core/domain/entities/product.entity';
import { Warehouse } from '../../../core/domain/entities/warehouse.entity';
import { StockQuant } from '../../../core/domain/entities/stock-quant.entity';
import { StockMove, StockMoveType } from '../../../core/domain/entities/stock-move.entity';
import { Cost } from '../../../core/domain/value-objects/cost.vo';
import { Quantity } from '../../../core/domain/value-objects/quantity.vo';
import { TenantContext } from '../in/tenant-context';

@Injectable()
export class PostgresInventoryRepository implements InventoryRepositoryPort {
  private readonly logger = new Logger(PostgresInventoryRepository.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private getRunner(): QueryRunner | DataSource {
    return TenantContext.getQueryRunner() || this.dataSource;
  }

  async findProductById(tenantId: string, id: string): Promise<Product | null> {
    const runner = this.getRunner();
    const rows = await runner.query(
      `SELECT id, tenant_id, sku, barcode, name, description, category, unit_of_measure,
              cost_price, sale_price, wholesale_price, tax_rate, min_stock_alert, is_active,
              created_at, updated_at
       FROM products
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
    );

    if (!rows || rows.length === 0) return null;
    return this.mapToProduct(rows[0]);
  }

  async findProductBySku(tenantId: string, sku: string): Promise<Product | null> {
    const runner = this.getRunner();
    const rows = await runner.query(
      `SELECT id, tenant_id, sku, barcode, name, description, category, unit_of_measure,
              cost_price, sale_price, wholesale_price, tax_rate, min_stock_alert, is_active,
              created_at, updated_at
       FROM products
       WHERE tenant_id = $1 AND sku = $2`,
      [tenantId, sku],
    );

    if (!rows || rows.length === 0) return null;
    return this.mapToProduct(rows[0]);
  }

  async findProducts(
    tenantId: string,
    filters?: { search?: string; category?: string; page?: number; limit?: number },
  ): Promise<{ data: ProductStockOverview[]; total: number }> {
    const runner = this.getRunner();
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['p.tenant_id = $1'];
    const params: any[] = [tenantId];

    if (filters?.search) {
      params.push(`%${filters.search}%`);
      conditions.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR p.barcode ILIKE $${params.length})`);
    }

    if (filters?.category) {
      params.push(filters.category);
      conditions.push(`p.category = $${params.length}`);
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await runner.query(
      `SELECT COUNT(*)::int AS count FROM products p WHERE ${whereClause}`,
      params,
    );
    const total = countRes[0]?.count || 0;

    const dataParams = [...params, limit, offset];
    const productRows = await runner.query(
      `SELECT p.id, p.tenant_id, p.sku, p.barcode, p.name, p.description, p.category, p.unit_of_measure,
              p.cost_price, p.sale_price, p.wholesale_price, p.tax_rate, p.min_stock_alert, p.is_active,
              p.created_at, p.updated_at
       FROM products p
       WHERE ${whereClause}
       ORDER BY p.name ASC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );

    const result: ProductStockOverview[] = [];

    for (const row of productRows) {
      const product = this.mapToProduct(row);

      const quantRows = await runner.query(
        `SELECT sq.warehouse_id, w.name AS warehouse_name, sq.quantity_on_hand, sq.reserved_quantity
         FROM stock_quants sq
         JOIN warehouses w ON w.id = sq.warehouse_id AND w.tenant_id = sq.tenant_id
         WHERE sq.tenant_id = $1 AND sq.product_id = $2`,
        [tenantId, product.id],
      );

      let totalOnHand = 0;
      let totalReserved = 0;
      const warehousesStock = quantRows.map((q: any) => {
        const onHand = parseFloat(q.quantity_on_hand) || 0;
        const reserved = parseFloat(q.reserved_quantity) || 0;
        totalOnHand += onHand;
        totalReserved += reserved;
        return {
          warehouseId: q.warehouse_id,
          warehouseName: q.warehouse_name,
          quantityOnHand: onHand,
          availableQuantity: Math.max(0, onHand - reserved),
        };
      });

      result.push({
        product,
        totalStockOnHand: totalOnHand,
        totalReserved,
        totalAvailable: Math.max(0, totalOnHand - totalReserved),
        warehousesStock,
      });
    }

    return { data: result, total };
  }

  async saveProduct(product: Product): Promise<Product> {
    const runner = this.getRunner();
    const rows = await runner.query(
      `INSERT INTO products (
         id, tenant_id, sku, barcode, name, description, category, unit_of_measure,
         cost_price, sale_price, wholesale_price, tax_rate, min_stock_alert, is_active,
         created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       ON CONFLICT (id) DO UPDATE SET
         sku = EXCLUDED.sku,
         barcode = EXCLUDED.barcode,
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         category = EXCLUDED.category,
         unit_of_measure = EXCLUDED.unit_of_measure,
         cost_price = EXCLUDED.cost_price,
         sale_price = EXCLUDED.sale_price,
         wholesale_price = EXCLUDED.wholesale_price,
         tax_rate = EXCLUDED.tax_rate,
         min_stock_alert = EXCLUDED.min_stock_alert,
         is_active = EXCLUDED.is_active,
         updated_at = EXCLUDED.updated_at
       RETURNING *`,
      [
        product.id,
        product.tenantId,
        product.sku,
        product.barcode || null,
        product.name,
        product.description || null,
        product.category,
        product.unitOfMeasure,
        product.costPrice.toNumber(),
        product.salePrice,
        product.wholesalePrice || null,
        product.taxRate,
        product.minStockAlert.toNumber(),
        product.isActive,
        product.createdAt,
        product.updatedAt,
      ],
    );

    return this.mapToProduct(rows[0]);
  }

  async updateProductCostPrice(tenantId: string, productId: string, newCost: Cost): Promise<void> {
    const runner = this.getRunner();
    await runner.query(
      `UPDATE products
       SET cost_price = $1, updated_at = NOW()
       WHERE tenant_id = $2 AND id = $3`,
      [newCost.toNumber(), tenantId, productId],
    );
  }

  async findWarehouseById(tenantId: string, id: string): Promise<Warehouse | null> {
    const runner = this.getRunner();
    const rows = await runner.query(
      `SELECT id, tenant_id, branch_id, code, name, address, is_active, created_at, updated_at
       FROM warehouses
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
    );

    if (!rows || rows.length === 0) return null;
    return this.mapToWarehouse(rows[0]);
  }

  async findWarehouses(tenantId: string, branchId?: string): Promise<Warehouse[]> {
    const runner = this.getRunner();
    const rows = await runner.query(
      `SELECT id, tenant_id, branch_id, code, name, address, is_active, created_at, updated_at
       FROM warehouses
       WHERE tenant_id = $1 AND ($2::uuid IS NULL OR branch_id = $2::uuid)
       ORDER BY code ASC`,
      [tenantId, branchId || null],
    );

    return rows.map((r: any) => this.mapToWarehouse(r));
  }

  async saveWarehouse(warehouse: Warehouse): Promise<Warehouse> {
    const runner = this.getRunner();
    const rows = await runner.query(
      `INSERT INTO warehouses (
         id, tenant_id, branch_id, code, name, address, is_active, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         code = EXCLUDED.code,
         name = EXCLUDED.name,
         address = EXCLUDED.address,
         is_active = EXCLUDED.is_active,
         updated_at = EXCLUDED.updated_at
       RETURNING *`,
      [
        warehouse.id,
        warehouse.tenantId,
        warehouse.branchId,
        warehouse.code,
        warehouse.name,
        warehouse.address || null,
        warehouse.isActive,
        warehouse.createdAt,
        warehouse.updatedAt,
      ],
    );

    return this.mapToWarehouse(rows[0]);
  }

  async getStockQuantWithLock(
    tenantId: string,
    productId: string,
    warehouseId: string,
  ): Promise<StockQuant | null> {
    const runner = this.getRunner();
    const rows = await runner.query(
      `SELECT id, tenant_id, product_id, warehouse_id, quantity_on_hand, reserved_quantity, updated_at
       FROM stock_quants
       WHERE tenant_id = $1 AND product_id = $2 AND warehouse_id = $3
       FOR UPDATE`,
      [tenantId, productId, warehouseId],
    );

    if (!rows || rows.length === 0) return null;
    return this.mapToStockQuant(rows[0]);
  }

  async saveStockQuant(quant: StockQuant): Promise<StockQuant> {
    const runner = this.getRunner();
    const rows = await runner.query(
      `INSERT INTO stock_quants (
         id, tenant_id, product_id, warehouse_id, quantity_on_hand, reserved_quantity, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (tenant_id, product_id, warehouse_id) DO UPDATE SET
         quantity_on_hand = EXCLUDED.quantity_on_hand,
         reserved_quantity = EXCLUDED.reserved_quantity,
         updated_at = EXCLUDED.updated_at
       RETURNING *`,
      [
        quant.id,
        quant.tenantId,
        quant.productId,
        quant.warehouseId,
        quant.quantityOnHand.toNumber(),
        quant.reservedQuantity.toNumber(),
        quant.updatedAt,
      ],
    );

    return this.mapToStockQuant(rows[0]);
  }

  async saveStockMove(move: StockMove): Promise<StockMove> {
    const runner = this.getRunner();
    const rows = await runner.query(
      `INSERT INTO stock_moves (
         id, tenant_id, product_id, warehouse_id, move_type, quantity, unit_cost,
         previous_stock, new_stock, reference_document, reference_document_id,
         created_by, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        move.id,
        move.tenantId,
        move.productId,
        move.warehouseId,
        move.moveType,
        move.quantity.toNumber(),
        move.unitCost.toNumber(),
        move.previousStock.toNumber(),
        move.newStock.toNumber(),
        move.referenceDocument || null,
        move.referenceDocumentId || null,
        move.createdBy,
        move.createdAt,
      ],
    );

    return this.mapToStockMove(rows[0]);
  }

  async findStockMoveById(tenantId: string, id: string): Promise<StockMove | null> {
    const runner = this.getRunner();
    const rows = await runner.query(
      `SELECT id, tenant_id, product_id, warehouse_id, move_type, quantity, unit_cost,
              total_cost, previous_stock, new_stock, reference_document, reference_document_id,
              created_by, created_at
       FROM stock_moves
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
    );

    if (!rows || rows.length === 0) return null;
    return this.mapToStockMove(rows[0]);
  }

  async getProductKardex(
    tenantId: string,
    productId: string,
    warehouseId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<KardexReport> {
    const runner = this.getRunner();
    const product = await this.findProductById(tenantId, productId);
    if (!product) {
      throw new Error(`Producto ${productId} no encontrado`);
    }

    const conditions: string[] = ['sm.tenant_id = $1', 'sm.product_id = $2'];
    const params: any[] = [tenantId, productId];

    if (warehouseId) {
      params.push(warehouseId);
      conditions.push(`sm.warehouse_id = $${params.length}`);
    }

    if (startDate) {
      params.push(startDate);
      conditions.push(`sm.created_at >= $${params.length}`);
    }

    if (endDate) {
      params.push(endDate);
      conditions.push(`sm.created_at <= $${params.length}`);
    }

    const moveRows = await runner.query(
      `SELECT sm.id, sm.created_at, sm.move_type, sm.quantity, sm.unit_cost, sm.total_cost,
              sm.previous_stock, sm.new_stock, sm.reference_document, w.name AS warehouse_name
       FROM stock_moves sm
       JOIN warehouses w ON w.id = sm.warehouse_id AND w.tenant_id = sm.tenant_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY sm.created_at ASC`,
      params,
    );

    // Calculate total stock across warehouses
    const stockRes = await runner.query(
      `SELECT COALESCE(SUM(quantity_on_hand), 0) AS total_stock
       FROM stock_quants
       WHERE tenant_id = $1 AND product_id = $2`,
      [tenantId, productId],
    );
    const totalStock = parseFloat(stockRes[0]?.total_stock) || 0;

    return {
      tenantId,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      unitOfMeasure: product.unitOfMeasure,
      currentCostPrice: product.costPrice.toNumber(),
      totalStock,
      movements: moveRows.map((r: any) => ({
        moveId: r.id,
        createdAt: r.created_at,
        moveType: r.move_type,
        warehouseName: r.warehouse_name,
        quantity: parseFloat(r.quantity),
        unitCost: parseFloat(r.unit_cost),
        totalCost: parseFloat(r.total_cost),
        previousStock: parseFloat(r.previous_stock),
        newStock: parseFloat(r.new_stock),
        referenceDocument: r.reference_document,
      })),
    };
  }

  async getStockAlerts(tenantId: string): Promise<any[]> {
    const runner = this.getRunner();
    const rows = await runner.query(
      `SELECT p.id, p.sku, p.name, p.min_stock_alert, p.unit_of_measure,
              COALESCE(SUM(sq.quantity_on_hand), 0) AS total_on_hand,
              COALESCE(SUM(sq.reserved_quantity), 0) AS total_reserved,
              COALESCE(SUM(sq.quantity_on_hand - sq.reserved_quantity), 0) AS total_available
       FROM products p
       LEFT JOIN stock_quants sq ON sq.product_id = p.id AND sq.tenant_id = p.tenant_id
       WHERE p.tenant_id = $1 AND p.is_active = TRUE
       GROUP BY p.id, p.sku, p.name, p.min_stock_alert, p.unit_of_measure
       HAVING COALESCE(SUM(sq.quantity_on_hand - sq.reserved_quantity), 0) <= p.min_stock_alert
       ORDER BY total_available ASC`,
      [tenantId],
    );

    return rows.map((r: any) => ({
      productId: r.id,
      sku: r.sku,
      name: r.name,
      unitOfMeasure: r.unit_of_measure,
      minStockAlert: parseFloat(r.min_stock_alert),
      totalOnHand: parseFloat(r.total_on_hand),
      totalReserved: parseFloat(r.total_reserved),
      totalAvailable: parseFloat(r.total_available),
      status: parseFloat(r.total_available) <= 0 ? 'CRITICAL_OUT_OF_STOCK' : 'LOW_STOCK_WARNING',
    }));
  }

  private mapToProduct(row: any): Product {
    return new Product(
      row.id,
      row.tenant_id,
      row.sku,
      row.name,
      row.category || 'GENERAL',
      row.unit_of_measure || 'UNIDAD',
      new Cost(parseFloat(row.cost_price || '0')),
      parseFloat(row.sale_price || '0'),
      parseFloat(row.tax_rate || '0.19'),
      new Quantity(parseFloat(row.min_stock_alert || '5')),
      row.barcode,
      row.description,
      row.wholesale_price ? parseFloat(row.wholesale_price) : null,
      row.is_active,
      new Date(row.created_at),
      new Date(row.updated_at),
    );
  }

  private mapToWarehouse(row: any): Warehouse {
    return new Warehouse(
      row.id,
      row.tenant_id,
      row.branch_id,
      row.code,
      row.name,
      row.address,
      row.is_active,
      new Date(row.created_at),
      new Date(row.updated_at),
    );
  }

  private mapToStockQuant(row: any): StockQuant {
    return new StockQuant(
      row.id,
      row.tenant_id,
      row.product_id,
      row.warehouse_id,
      new Quantity(parseFloat(row.quantity_on_hand || '0')),
      new Quantity(parseFloat(row.reserved_quantity || '0')),
      new Date(row.updated_at),
    );
  }

  private mapToStockMove(row: any): StockMove {
    return new StockMove(
      row.id,
      row.tenant_id,
      row.product_id,
      row.warehouse_id,
      row.move_type as StockMoveType,
      new Quantity(parseFloat(row.quantity || '0')),
      new Cost(parseFloat(row.unit_cost || '0')),
      new Cost(parseFloat(row.total_cost || '0')),
      new Quantity(parseFloat(row.previous_stock || '0')),
      new Quantity(parseFloat(row.new_stock || '0')),
      row.created_by,
      row.reference_document,
      row.reference_document_id,
      new Date(row.created_at),
    );
  }
}
