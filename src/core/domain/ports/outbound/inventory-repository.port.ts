import { Product } from '../../entities/product.entity';
import { Warehouse } from '../../entities/warehouse.entity';
import { StockQuant } from '../../entities/stock-quant.entity';
import { StockMove } from '../../entities/stock-move.entity';
import { Cost } from '../../value-objects/cost.vo';

export interface ProductStockOverview {
  product: Product;
  totalStockOnHand: number;
  totalReserved: number;
  totalAvailable: number;
  warehousesStock: Array<{
    warehouseId: string;
    warehouseName: string;
    quantityOnHand: number;
    availableQuantity: number;
  }>;
}

export interface KardexReport {
  tenantId: string;
  productId: string;
  productName: string;
  sku: string;
  unitOfMeasure: string;
  currentCostPrice: number;
  totalStock: number;
  movements: Array<{
    moveId: string;
    createdAt: Date;
    moveType: string;
    warehouseName: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    previousStock: number;
    newStock: number;
    referenceDocument?: string | null;
  }>;
}

export interface InventoryRepositoryPort {
  findProductById(tenantId: string, id: string): Promise<Product | null>;
  findProductBySku(tenantId: string, sku: string): Promise<Product | null>;
  findProducts(
    tenantId: string,
    filters?: { search?: string; category?: string; page?: number; limit?: number },
  ): Promise<{ data: ProductStockOverview[]; total: number }>;
  saveProduct(product: Product): Promise<Product>;
  updateProductCostPrice(tenantId: string, productId: string, newCost: Cost): Promise<void>;
  findWarehouseById(tenantId: string, id: string): Promise<Warehouse | null>;
  findWarehouses(tenantId: string, branchId?: string): Promise<Warehouse[]>;
  saveWarehouse(warehouse: Warehouse): Promise<Warehouse>;
  getStockQuantWithLock(tenantId: string, productId: string, warehouseId: string): Promise<StockQuant | null>;
  saveStockQuant(quant: StockQuant): Promise<StockQuant>;
  saveStockMove(move: StockMove): Promise<StockMove>;
  findStockMoveById(tenantId: string, id: string): Promise<StockMove | null>;
  getProductKardex(
    tenantId: string,
    productId: string,
    warehouseId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<KardexReport>;
  getStockAlerts(tenantId: string): Promise<any[]>;
}

export const INVENTORY_REPOSITORY_PORT = Symbol('InventoryRepositoryPort');
