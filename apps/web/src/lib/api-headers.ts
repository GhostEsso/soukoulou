/**
 * En-têtes ajoutés à chaque appel du web vers l'API :
 * - X-Api-Secret : secret partagé quand l'API est publique (API_SECRET, hébergement séparé) ;
 * - X-Client-Ip : IP du visiteur (posée par Vercel ou le proxy), pour limiter les connexions par visiteur.
 */
export function apiHeaders(forwardedFor: string | null): Record<string, string> {
  const h: Record<string, string> = {};
  if (process.env.API_SECRET) h["X-Api-Secret"] = process.env.API_SECRET;
  // Dernière entrée : celle ajoutée par notre proxy (Vercel, Traefik, Caddy). Les premières
  // peuvent venir du visiteur lui-même, qui contournerait alors la limite de connexions.
  const ip = forwardedFor?.split(",").map((s) => s.trim()).filter(Boolean).at(-1);
  if (ip) h["X-Client-Ip"] = ip;
  return h;
}
