import { SetMetadata } from '@nestjs/common';
import { ROLES_METADATA_KEY, UserRole } from '@saas/contracts';

export const ROLES_KEY = ROLES_METADATA_KEY;
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
