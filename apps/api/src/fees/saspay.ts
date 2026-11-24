import {
  BadGatewayException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Client SasPay minimal (checkout hébergé + vérification), d'après /api-reference/openapi.json.
 * La clé reste côté serveur ; elle n'apparaît ni dans les logs ni dans les réponses.
 * Le bac à sable se choisit par l'URL (sandbox-api.saspay.me), jamais par le préfixe de la clé.
 */
export const SASPAY_SANDBOX_URL = 'https://sandbox-api.saspay.me/api/v1';

export const saspayConfigured = () => !!process.env.SASPAY_API_KEY;

/** Montant entier en FCFA vers la chaîne décimale attendue par SasPay (« 2500.00 »). */
export const decimal = (amount: number) => `${amount}.00`;

/** Webhook SasPay : âge ≤ 300 s, puis HMAC SHA-256 de « {timestamp}.{corps brut} », comparé en temps constant. */
export function saspaySignatureValid(
  rawBody: Buffer,
  signature: string | undefined,
  timestamp: string | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const ts = Number(timestamp);
  if (!timestamp || !Number.isInteger(ts) || Math.abs(nowSeconds - ts) > 300)
    return false;
  const expected = createHmac('sha256', secret)
    .update(Buffer.concat([Buffer.from(`${timestamp}.`), rawBody]))
    .digest();
  const given = Buffer.from(signature ?? '', 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export interface CheckoutSession {
  id: string;
  checkout_url: string;
}
export interface SessionStatus {
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  transaction_id: string | null;
  transaction_status: string | null;
}
export interface VerifiedPayment {
  status: string; // PENDING | SUCCESS | FAILED
  net_amount: string;
  currency: string;
}

const logger = new Logger('SasPay');

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = process.env.SASPAY_API_URL || SASPAY_SANDBOX_URL;
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${process.env.SASPAY_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...init.headers,
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ServiceUnavailableException(
      'Le service de paiement ne répond pas. Réessayez dans un instant.',
    );
  }
  const body = (await res.json().catch(() => null)) as {
    data?: T;
    error?: { code?: string; message?: string };
    code?: string;
  } | null;
  if (res.ok) return (body?.data ?? body) as T; // enveloppe { success, data, code } ou objet nu
  // 401 / 403 (clé, scope, IP) : erreur de configuration côté Soukoulou, jamais montrée telle quelle.
  const code = body?.error?.code ?? body?.code ?? '';
  logger.error(`${init.method ?? 'GET'} ${path} : HTTP ${res.status} ${code}`);
  if (res.status === 429)
    throw new ServiceUnavailableException(
      'Trop de demandes de paiement en même temps. Réessayez dans une minute.',
    );
  throw new BadGatewayException(
    'Le paiement en ligne est momentanément indisponible.',
  );
}

export const saspay = {
  createCheckoutSession: (input: {
    amount: number;
    customerEmail: string;
    customerName: string;
    customerPhone?: string;
    returnUrl: string;
    metadata: Record<string, string>;
  }) =>
    call<CheckoutSession>('/checkout-sessions/', {
      method: 'POST',
      body: JSON.stringify({
        amount: decimal(input.amount),
        currency: 'XOF',
        country: 'TG',
        description: 'Frais de scolarité',
        customer_email: input.customerEmail,
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
        return_url: input.returnUrl,
        metadata: input.metadata,
        // Le parent paie les frais SasPay en plus : l'école reçoit exactement le montant dû.
        fee_charge_mode: 'ADD_ON',
      }),
    }),
  sessionStatus: (id: string) =>
    call<SessionStatus>(`/checkout-sessions/${encodeURIComponent(id)}/status/`),
  verifyPayment: (id: string) =>
    call<VerifiedPayment>(`/payments/${encodeURIComponent(id)}/verify/`),
};
