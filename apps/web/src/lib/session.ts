// Noms et options des cookies de session. Partagé par les actions serveur et src/proxy.ts.

export const ACCESS_COOKIE = "sk_at";
export const REFRESH_COOKIE = "sk_rt";

const base = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export const accessCookie = (value: string) => ({
  name: ACCESS_COOKIE,
  value,
  ...base,
  maxAge: 15 * 60,
});

export const refreshCookie = (value: string) => ({
  name: REFRESH_COOKIE,
  value,
  ...base,
  maxAge: 30 * 24 * 3600,
});

/** Date d'expiration (secondes) d'un JWT, sans vérifier sa signature (l'API la vérifie). */
export function jwtExp(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    return typeof payload.exp === "number" ? payload.exp : 0;
  } catch {
    return 0;
  }
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}
