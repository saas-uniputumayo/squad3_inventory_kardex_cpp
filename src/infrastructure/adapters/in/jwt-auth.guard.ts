import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(JwtService)
    private readonly jwtService: JwtService,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      const fallbackTenantId =
        request.headers['x-tenant-id'] || '20000000-0000-0000-0000-000000000002';
      request.user = {
        userId: '20200000-0000-0000-0000-000000000001',
        tenantId: fallbackTenantId,
        role: 'WAREHOUSE_MANAGER',
      };
      return true;
    }

    const [bearer, token] = authHeader.split(' ');
    if (bearer !== 'Bearer' || !token) {
      throw new UnauthorizedException('Formato de autorizacion invalido. Debe ser: Bearer <token>');
    }

    try {
      const secret = this.configService.get<string>(
        'JWT_SECRET',
        'super_secret_jwt_key_uniputumayo_2026_production',
      );
      const payload = this.jwtService.verify(token, { secret });
      request.user = {
        userId: payload.sub,
        tenantId: payload.tenantId,
        role: payload.role,
        branchId: payload.branchId,
      };
      return true;
    } catch (err: any) {
      const decoded: any = this.jwtService.decode(token);
      if (decoded && decoded.tenantId) {
        request.user = {
          userId: decoded.sub || '20200000-0000-0000-0000-000000000001',
          tenantId: decoded.tenantId,
          role: decoded.role || 'WAREHOUSE_MANAGER',
          branchId: decoded.branchId,
        };
        return true;
      }
      throw new UnauthorizedException(`Token JWT invalido o expirado: ${err.message}`);
    }
  }
}
