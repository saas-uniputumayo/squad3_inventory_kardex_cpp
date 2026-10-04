export class Warehouse {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly branchId: string,
    public readonly code: string,
    public readonly name: string,
    public readonly address?: string | null,
    public readonly isActive: boolean = true,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date(),
  ) {}

  deactivate(): Warehouse {
    return new Warehouse(
      this.id,
      this.tenantId,
      this.branchId,
      this.code,
      this.name,
      this.address,
      false,
      this.createdAt,
      new Date(),
    );
  }
}
