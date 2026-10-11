import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { SessionValidator, UserRole } from '@saas/contracts';
import { of } from 'rxjs';
import { TenantContext } from '../../src/infrastructure/context/tenant-context';
import { JwtAuthGuard } from '../../src/presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/presentation/guards/roles.guard';
import { TenantInterceptor } from '../../src/presentation/interceptors/tenant.interceptor';

describe('Guards and Interceptors', () => {
    describe('RolesGuard', () => {
        let guard: RolesGuard;
        let reflector: Reflector;

        beforeEach(() => {
            reflector = new Reflector();
            guard = new RolesGuard(reflector);
        });

        const createMockContext = (user?: any): ExecutionContext => {
            return {
                getHandler: () => ({}),
                getClass: () => ({}),
                switchToHttp: () => ({
                    getRequest: () => ({ user }),
                }),
            } as unknown as ExecutionContext;
        };

        it('allows access when no roles are configured on handler/class', () => {
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
            const context = createMockContext({ role: UserRole.CASHIER });

            expect(guard.canActivate(context)).toBe(true);
        });

        it('throws ForbiddenException when user is not present on request', () => {
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
            const context = createMockContext(undefined);

            expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
        });

        it('throws ForbiddenException when user role is not authorized', () => {
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.OWNER, UserRole.ADMIN]);
            const context = createMockContext({ role: UserRole.CASHIER });

            expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
        });

        it('allows access when user has one of the allowed roles', () => {
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.OWNER, UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER]);
            const context = createMockContext({ role: UserRole.WAREHOUSE_MANAGER });

            expect(guard.canActivate(context)).toBe(true);
        });
    });

    describe('JwtAuthGuard', () => {
        let guard: JwtAuthGuard;
        let jwtService: jest.Mocked<JwtService>;
        let configService: jest.Mocked<ConfigService>;
        let sessionValidator: jest.Mocked<SessionValidator>;

        beforeEach(() => {
            jwtService = {
                verifyAsync: jest.fn(),
            } as any;
            configService = {
                get: jest.fn().mockReturnValue('test-secret-key-2026'),
            } as any;
            sessionValidator = {
                isSessionActive: jest.fn().mockResolvedValue(true),
            };
            guard = new JwtAuthGuard(jwtService, configService, sessionValidator);
        });

        const createContextWithHeader = (authHeader?: string, requestTarget: any = {}): ExecutionContext => {
            requestTarget.headers = authHeader ? { authorization: authHeader } : {};
            return {
                switchToHttp: () => ({
                    getRequest: () => requestTarget,
                }),
            } as unknown as ExecutionContext;
        };

        it('throws UnauthorizedException when Authorization header is missing', async () => {
            const context = createContextWithHeader(undefined);
            await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
        });

        it('throws UnauthorizedException when Authorization header is not Bearer', async () => {
            const context = createContextWithHeader('Basic abc123');
            await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
        });

        it('throws UnauthorizedException when token verification fails', async () => {
            jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));
            const context = createContextWithHeader('Bearer invalid-token');

            await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
        });

        it('throws UnauthorizedException when payload lacks tenantId or sub', async () => {
            jwtService.verifyAsync.mockResolvedValue({ role: UserRole.ADMIN } as any);
            const context = createContextWithHeader('Bearer valid-token');

            await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
        });

        it('throws UnauthorizedException when session has been invalidated in Redis (jti revoked)', async () => {
            const payload = {
                sub: 'user-123',
                tenantId: 'tenant-456',
                role: UserRole.ADMIN,
                jti: 'revoked-session-uuid',
            };
            jwtService.verifyAsync.mockResolvedValue(payload as any);
            sessionValidator.isSessionActive.mockResolvedValue(false);

            const context = createContextWithHeader('Bearer valid-token');

            await expect(guard.canActivate(context)).rejects.toThrow('Sesión expirada o invalidada');
            expect(sessionValidator.isSessionActive).toHaveBeenCalledWith('user-123', 'revoked-session-uuid');
        });

        it('attaches verified user to request.user and returns true when session is active', async () => {
            const req: any = {};
            const payload = {
                sub: 'user-123',
                tenantId: 'tenant-456',
                role: UserRole.ADMIN,
                jti: 'active-session-uuid',
            };
            jwtService.verifyAsync.mockResolvedValue(payload as any);
            sessionValidator.isSessionActive.mockResolvedValue(true);
            const context = createContextWithHeader('Bearer valid-token', req);

            const result = await guard.canActivate(context);

            expect(result).toBe(true);
            expect(req.user).toEqual(payload);
            expect(sessionValidator.isSessionActive).toHaveBeenCalledWith('user-123', 'active-session-uuid');
        });
    });

    describe('TenantInterceptor', () => {
        let interceptor: TenantInterceptor;

        beforeEach(() => {
            interceptor = new TenantInterceptor();
        });

        it('wraps execution inside TenantContext.run setting tenantId and userId', async () => {
            const mockRequest = {
                user: {
                    tenantId: 'tenant-test-777',
                    sub: 'actor-test-888',
                },
            };
            const mockContext = {
                switchToHttp: () => ({
                    getRequest: () => mockRequest,
                }),
            } as unknown as ExecutionContext;

            let capturedTenantId: string | undefined;
            let capturedUserId: string | undefined;

            const next = {
                handle: () => {
                    capturedTenantId = TenantContext.getTenantId();
                    capturedUserId = TenantContext.getUserId();
                    return of({ success: true });
                },
            };

            const observable = interceptor.intercept(mockContext, next);
            await new Promise<void>((resolve) => {
                observable.subscribe({
                    next: () => {
                        expect(capturedTenantId).toBe('tenant-test-777');
                        expect(capturedUserId).toBe('actor-test-888');
                        resolve();
                    },
                });
            });
        });

        it('throws UnauthorizedException if request.user is missing on intercept', () => {
            const mockContext = {
                switchToHttp: () => ({
                    getRequest: () => ({}),
                }),
            } as unknown as ExecutionContext;
            const next = { handle: () => of(null) };

            expect(() => interceptor.intercept(mockContext, next)).toThrow(UnauthorizedException);
        });
    });
});
