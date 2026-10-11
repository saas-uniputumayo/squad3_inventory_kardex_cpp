import {
    CanActivate,
    ExecutionContext,
    Inject,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedUser, SESSION_VALIDATOR_PORT, SessionValidator } from '@saas/contracts';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        @Inject(SESSION_VALIDATOR_PORT)
        private readonly sessionValidator: SessionValidator,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();
        const token = this.extractTokenFromHeader(request);

        if (!token) {
            throw new UnauthorizedException('Token de autenticación no provisto');
        }

        const secret = this.configService.get<string>('JWT_SECRET');
        if (!secret) {
            throw new UnauthorizedException('Variable de entorno JWT_SECRET obligatoria no configurada en el servidor');
        }

        try {
            const payload = await this.jwtService.verifyAsync<AuthenticatedUser>(token, {
                secret,
            });

            // Validación estricta de claims obligatorios: sub, tenantId, role y jti (CRÍTICO 6)
            if (!payload.tenantId || !payload.sub || !payload.role || !payload.jti) {
                throw new UnauthorizedException(
                    'Payload de token inválido o incompleto: claims sub, tenantId, role y jti son obligatorios',
                );
            }

            // Validación transversal de sesión activa (revocación jti en Redis obligatoria)
            const isSessionActive = await this.sessionValidator.isSessionActive(
                payload.sub,
                payload.jti,
            );

            if (!isSessionActive) {
                throw new UnauthorizedException('Sesión expirada o invalidada');
            }

            (request as any).user = payload;
            return true;
        } catch (error: any) {
            if (error instanceof UnauthorizedException) {
                throw error;
            }
            throw new UnauthorizedException('Token inválido, expirado o malformado');
        }
    }

    private extractTokenFromHeader(request: Request): string | undefined {
        const authHeader = request.headers.authorization;
        if (!authHeader) {
            return undefined;
        }

        const [type, token] = authHeader.split(' ');
        return type === 'Bearer' ? token : undefined;
    }
}
