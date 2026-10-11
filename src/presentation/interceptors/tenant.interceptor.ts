import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
    UnauthorizedException,
} from '@nestjs/common';
import { from, Observable } from 'rxjs';
import { TenantContext } from '../../infrastructure/context/tenant-context';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const user = request.user as AuthenticatedUser;

        if (!user || !user.tenantId) {
            throw new UnauthorizedException(
                'Usuario no autenticado o sin tenantId en el token. No se puede establecer el contexto de ejecución multi-tenant.',
            );
        }

        return from(
            TenantContext.run(
                { tenantId: user.tenantId, userId: user.sub },
                () => next.handle().toPromise(),
            ),
        );
    }
}
