export class InsufficientStockException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientStockException';
  }
}

export class ProductNotFoundException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductNotFoundException';
  }
}

export class WarehouseNotFoundException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WarehouseNotFoundException';
  }
}

export class InactiveProductException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InactiveProductException';
  }
}

export class InvalidStockMovementException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStockMovementException';
  }
}

export class DuplicateSkuException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateSkuException';
  }
}

export class InventoryValidationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryValidationException';
  }
}
