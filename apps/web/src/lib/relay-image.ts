import { cookies } from "next/headers";
import { API_URL } from "@/lib/api";
import { apiHeaders } from "@/lib/api-headers";
import { ACCESS_COOKIE } from "@/lib/session";

/**
 * Relaie une image privée de l'API (bucket privé, droits vérifiés par l'API).
 * L'URL appelante porte `?v=<version>` : une nouvelle image change l'URL, on peut donc la garder en cache.
 */
export async function relayImage(req: Request, apiPath: string) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const res = await fetch(`${API_URL}${apiPath}`, {
    headers: {
      Authorization: `Bearer ${token ?? ""}`,
      ...apiHeaders(req.headers.get("x-forwarded-for")),
    },
    cache: "no-store",
  });
  if (!res.ok || !res.body) return new Response(null, { status: res.status === 403 ? 403 : 404 });
  return new Response(res.body, {
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
