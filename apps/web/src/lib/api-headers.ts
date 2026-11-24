/**
 * En-têtes ajoutés à chaque appel du web vers l'API :
 * - X-Api-Secret : secret partagé quand l'API est publique (API_SECRET, hébergement séparé) ;
 * - X-Client-Ip : IP du visiteur (posée par Vercel ou le proxy), pour limiter les connexions par visiteur.
 */
export function apiHeaders(forwardedFor: string | null): Record<string, string> {
  const h: Record<string, string> = {};
  if (process.env.API_SECRET) h["X-Api-Secret"] = process.env.API_SECRET;
  const ip = forwardedFor?.split(",")[0]?.trim();
  if (ip) h["X-Client-Ip"] = ip;
  return h;
}
