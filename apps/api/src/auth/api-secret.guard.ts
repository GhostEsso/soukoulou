import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';

/** En-tête porté par le serveur web (et la tâche planifiée) quand l'API est publique. */
export const API_SECRET_HEADER = 'x-api-secret';

/** Vrai si la requête porte le secret partagé API_SECRET. */
export function hasApiSecret(req: Request) {
  const secret = process.env.API_SECRET;
  const given = req.headers[API_SECRET_HEADER];
  if (!secret || typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * API publique (hébergement séparé du web) : seul le serveur web, qui connaît API_SECRET,
 * peut l'appeler. Sans API_SECRET (dev, Docker Compose où l'API est interne), rien n'est exigé.
 * /health reste ouvert pour la sonde de l'hébergeur.
 */
@Injectable()
export class ApiSecretGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    if (!process.env.API_SECRET) return true;
    const req = ctx.switchToHttp().getRequest<Request>();
    if (req.path === '/health' || hasApiSecret(req)) return true;
    throw new ForbiddenException();
  }
}

/**
 * Limite de requêtes par visiteur : le serveur web transmet l'IP du visiteur (X-Client-Ip).
 * On ne croit cet en-tête que s'il vient du web : API interne, ou secret partagé vérifié.
 */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    const r = req as Request;
    const ip = r.headers['x-client-ip'];
    const trusted = !process.env.API_SECRET || hasApiSecret(r);
    return Promise.resolve(
      trusted && typeof ip === 'string' && ip ? ip : (r.ip ?? ''),
    );
  }
}
