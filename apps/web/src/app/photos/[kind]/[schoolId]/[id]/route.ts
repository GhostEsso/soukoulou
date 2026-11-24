import { cookies } from "next/headers";
import { API_URL } from "@/lib/api";
import { apiHeaders } from "@/lib/api-headers";
import { ACCESS_COOKIE } from "@/lib/session";

/** Segment d'URL → ressource de l'API. */
const KINDS: Record<string, string> = { enseignants: "teachers", eleves: "students" };

/**
 * Relaie la photo d'un enseignant ou d'un élève depuis l'API (bucket privé, droits vérifiés par l'API).
 * L'URL porte `?v=<version>` : une nouvelle photo change l'URL, on peut donc la garder en cache.
 */
export async function GET(req: Request, ctx: RouteContext<"/photos/[kind]/[schoolId]/[id]">) {
  const { kind, schoolId, id } = await ctx.params;
  const resource = KINDS[kind];
  if (!resource) return new Response(null, { status: 404 });
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const res = await fetch(
    `${API_URL}/schools/${encodeURIComponent(schoolId)}/${resource}/${encodeURIComponent(id)}/photo`,
    {
      headers: {
        Authorization: `Bearer ${token ?? ""}`,
        ...apiHeaders(req.headers.get("x-forwarded-for")),
      },
      cache: "no-store",
    },
  );
  if (!res.ok || !res.body) return new Response(null, { status: res.status === 403 ? 403 : 404 });
  return new Response(res.body, {
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
