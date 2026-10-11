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

        try {
            const secret = this.configService.get<string>('JWT_SECRET');

            if (!secret && process.env.NODE_ENV === 'production') {
                throw new UnauthorizedException('JWT_SECRET no configurado en producción');
            }

            const effectiveSecret =
                secret ||
                process.env.JWT_SECRET ||
                'uniputumayo-saas-dev-secret-key-2026';

            const payload = await this.jwtService.verifyAsync<AuthenticatedUser>(token, {
                secret: effectiveSecret,
            });

            if (!payload.tenantId || !payload.sub) {
                throw new UnauthorizedException('Payload de token inválido o incompleto');
            }

            // Validación transversal de sesión activa (revocación jti en Redis)
            if (payload.jti) {
                const isSessionActive = await this.sessionValidator.isSessionActive(
                    payload.sub,
                    payload.jti,
                );

                if (!isSessionActive) {
                    throw new UnauthorizedException('Sesión expirada o invalidada');
                }
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
