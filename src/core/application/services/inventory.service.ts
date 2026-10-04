import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  INVENTORY_REPOSITORY_PORT,
  InventoryRepositoryPort,
  KardexReport,
  ProductStockOverview,
} from '../../domain/ports/outbound/inventory-repository.port';
import { CreateProductUseCase } from '../use-cases/create-product.use-case';
import { UpdateProductUseCase } from '../use-cases/update-product.use-case';
import { ListProductsUseCase } from '../use-cases/list-products.use-case';
import { CreateWarehouseUseCase } from '../use-cases/create-warehouse.use-case';
import { ListWarehousesUseCase } from '../use-cases/list-warehouses.use-case';
import { DispatchStockUseCase, DispatchStockResult } from '../use-cases/dispatch-stock.use-case';
import { ReceiveStockUseCase, ReceiveStockResult } from '../use-cases/receive-stock.use-case';
import { ReverseStockMoveUseCase, ReverseMoveResult } from '../use-cases/reverse-stock-move.use-case';
import { TransferStockUseCase, TransferStockResult } from '../use-cases/transfer-stock.use-case';
import { GetKardexUseCase } from '../use-cases/get-kardex.use-case';
import { GetStockAlertsUseCase } from '../use-cases/get-stock-alerts.use-case';

import { CreateProductDto } from '../dtos/create-product.dto';
import { UpdateProductDto } from '../dtos/update-product.dto';
import { CreateWarehouseDto } from '../dtos/create-warehouse.dto';
import { DispatchStockDto } from '../dtos/dispatch-stock.dto';
import { ReceiveStockDto } from '../dtos/receive-stock.dto';
import { ReverseMoveDto } from '../dtos/reverse-move.dto';
import { TransferStockDto } from '../dtos/transfer-stock.dto';

import { Product } from '../../domain/entities/product.entity';
import { Warehouse } from '../../domain/entities/warehouse.entity';
import {
  ProductNotFoundException,
  WarehouseNotFoundException,
  InsufficientStockException,
  DuplicateSkuException,
  InventoryValidationException,
} from '../../domain/exceptions/inventory.exceptions';

@Injectable()
export class InventoryService {
  private readonly createProductUseCase: CreateProductUseCase;
  private readonly updateProductUseCase: UpdateProductUseCase;
  private readonly listProductsUseCase: ListProductsUseCase;
  private readonly createWarehouseUseCase: CreateWarehouseUseCase;
  private readonly listWarehousesUseCase: ListWarehousesUseCase;
  private readonly dispatchStockUseCase: DispatchStockUseCase;
  private readonly receiveStockUseCase: ReceiveStockUseCase;
  private readonly reverseStockMoveUseCase: ReverseStockMoveUseCase;
  private readonly transferStockUseCase: TransferStockUseCase;
  private readonly getKardexUseCase: GetKardexUseCase;
  private readonly getStockAlertsUseCase: GetStockAlertsUseCase;

  constructor(
    @Inject(INVENTORY_REPOSITORY_PORT)
    private readonly repository: InventoryRepositoryPort,
  ) {
    this.createProductUseCase = new CreateProductUseCase(repository);
    this.updateProductUseCase = new UpdateProductUseCase(repository);
    this.listProductsUseCase = new ListProductsUseCase(repository);
    this.createWarehouseUseCase = new CreateWarehouseUseCase(repository);
    this.listWarehousesUseCase = new ListWarehousesUseCase(repository);
    this.dispatchStockUseCase = new DispatchStockUseCase(repository);
    this.receiveStockUseCase = new ReceiveStockUseCase(repository);
    this.reverseStockMoveUseCase = new ReverseStockMoveUseCase(repository);
    this.transferStockUseCase = new TransferStockUseCase(repository);
    this.getKardexUseCase = new GetKardexUseCase(repository);
    this.getStockAlertsUseCase = new GetStockAlertsUseCase(repository);
  }

  async createProduct(tenantId: string, dto: CreateProductDto): Promise<Product> {
    try {
      return await this.createProductUseCase.execute(tenantId, dto);
    } catch (error: any) {
      if (error instanceof DuplicateSkuException) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  async updateProduct(tenantId: string, id: string, dto: UpdateProductDto): Promise<Product> {
    try {
      return await this.updateProductUseCase.execute(tenantId, id, dto);
    } catch (error: any) {
      if (error instanceof ProductNotFoundException) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  async listProducts(
    tenantId: string,
    filters?: { search?: string; category?: string; page?: number; limit?: number },
  ): Promise<{ data: ProductStockOverview[]; total: number }> {
    return this.listProductsUseCase.execute(tenantId, filters);
  }

  async createWarehouse(tenantId: string, dto: CreateWarehouseDto): Promise<Warehouse> {
    return this.createWarehouseUseCase.execute(tenantId, dto);
  }

  async listWarehouses(tenantId: string, branchId?: string): Promise<Warehouse[]> {
    return this.listWarehousesUseCase.execute(tenantId, branchId);
  }

  async dispatchStock(
    tenantId: string,
    dto: DispatchStockDto,
    userId: string,
  ): Promise<DispatchStockResult> {
    try {
      return await this.dispatchStockUseCase.execute(tenantId, dto, userId);
    } catch (error: any) {
      if (error instanceof ProductNotFoundException || error instanceof WarehouseNotFoundException) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof InsufficientStockException) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  async receiveStock(
    tenantId: string,
    dto: ReceiveStockDto,
    userId: string,
  ): Promise<ReceiveStockResult> {
    try {
      return await this.receiveStockUseCase.execute(tenantId, dto, userId);
    } catch (error: any) {
      if (error instanceof ProductNotFoundException || error instanceof WarehouseNotFoundException) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  async reverseStockMove(
    tenantId: string,
    dto: ReverseMoveDto,
    userId: string,
  ): Promise<ReverseMoveResult> {
    try {
      return await this.reverseStockMoveUseCase.execute(tenantId, dto, userId);
    } catch (error: any) {
      if (error instanceof InsufficientStockException || error instanceof InventoryValidationException) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  async transferStock(
    tenantId: string,
    dto: TransferStockDto,
    userId: string,
  ): Promise<TransferStockResult> {
    try {
      return await this.transferStockUseCase.execute(tenantId, dto, userId);
    } catch (error: any) {
      if (error instanceof ProductNotFoundException || error instanceof WarehouseNotFoundException) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof InsufficientStockException || error instanceof InventoryValidationException) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  async getKardex(
    tenantId: string,
    productId: string,
    warehouseId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<KardexReport> {
    try {
      return await this.getKardexUseCase.execute(tenantId, productId, warehouseId, startDate, endDate);
    } catch (error: any) {
      if (error instanceof ProductNotFoundException) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  async getStockAlerts(tenantId: string): Promise<any[]> {
    return this.getStockAlertsUseCase.execute(tenantId);
  }
}
