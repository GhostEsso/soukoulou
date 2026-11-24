import { cookies } from "next/headers";
import { API_URL } from "@/lib/api";
import { apiHeaders } from "@/lib/api-headers";
import { ACCESS_COOKIE } from "@/lib/session";

/** Relaie une pièce justificative depuis l'API, avec le jeton de la session (jamais de lien public). */
export async function GET(req: Request, ctx: RouteContext<"/fichiers/[schoolId]/[documentId]">) {
  const { schoolId, documentId } = await ctx.params;
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const res = await fetch(
    `${API_URL}/schools/${encodeURIComponent(schoolId)}/documents/${encodeURIComponent(documentId)}/file`,
    {
      headers: {
        Authorization: `Bearer ${token ?? ""}`,
        ...apiHeaders(req.headers.get("x-forwarded-for")),
      },
      cache: "no-store",
    },
  );
  if (!res.ok || !res.body) return new Response("Introuvable", { status: res.status === 403 ? 403 : 404 });
  return new Response(res.body, {
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": res.headers.get("content-disposition") ?? "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
