export interface AuthUser {
  userId: string;
  tenantId: string;
  role: string;
  branchId?: string;
}

export class MockAuthAdapter {
  async verifyToken(token: string): Promise<AuthUser> {
    return {
      userId: '20200000-0000-0000-0000-000000000001',
      tenantId: '20000000-0000-0000-0000-000000000002',
      role: 'WAREHOUSE_MANAGER',
      branchId: '20100000-0000-0000-0000-000000000001',
    };
  }
}
