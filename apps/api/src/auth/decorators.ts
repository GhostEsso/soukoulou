import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';

export interface AuthUser {
  id: string;
  isPlatformAdmin: boolean;
}

export const IS_PUBLIC = 'isPublic';
export const PLATFORM_ADMIN = 'platformAdmin';

/** Route accessible sans connexion. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Route réservée aux admins Soukoulou. */
export const PlatformAdminOnly = () => SetMetadata(PLATFORM_ADMIN, true);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest<{ user: AuthUser }>().user,
);
