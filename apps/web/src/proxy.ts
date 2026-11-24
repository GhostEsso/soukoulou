import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessCookie,
  jwtExp,
  refreshCookie,
  type Tokens,
} from "@/lib/session";
import { apiHeaders } from "@/lib/api-headers";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

/**
 * Protège l'espace connecté et rafraîchit le jeton d'accès avant le rendu,
 * pour que les composants serveur aient toujours un jeton valide.
 */
export async function proxy(request: NextRequest) {
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  const fresh = access && jwtExp(access) - Date.now() / 1000 > 30;
  if (fresh) return NextResponse.next();

  const login = new URL("/connexion", request.url);
  login.searchParams.set("suite", request.nextUrl.pathname);
  if (!refresh) return NextResponse.redirect(login);

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...apiHeaders(request.headers.get("x-forwarded-for")),
    },
    body: JSON.stringify({ refreshToken: refresh }),
  }).catch(() => null);

  if (!res?.ok) {
    const out = NextResponse.redirect(login);
    out.cookies.delete(ACCESS_COOKIE);
    out.cookies.delete(REFRESH_COOKIE);
    return out;
  }

  const tokens = (await res.json()) as Tokens;
  // Visible tout de suite par le rendu en cours…
  request.cookies.set(ACCESS_COOKIE, tokens.accessToken);
  request.cookies.set(REFRESH_COOKIE, tokens.refreshToken);
  const out = NextResponse.next({ request: { headers: request.headers } });
  // …et enregistré dans le navigateur.
  out.cookies.set(accessCookie(tokens.accessToken));
  out.cookies.set(refreshCookie(tokens.refreshToken));
  return out;
}

export const config = {
  matcher: ["/ecole/:path*", "/impression/:path*", "/admin/:path*", "/espace", "/fichiers/:path*", "/photos/:path*", "/prof/:path*", "/parent/:path*", "/eleve/:path*", "/mot-de-passe/choisir"],
};
