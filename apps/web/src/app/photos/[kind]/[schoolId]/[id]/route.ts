import { relayImage } from "@/lib/relay-image";

/** Segment d'URL → ressource de l'API. */
const KINDS: Record<string, string> = { enseignants: "teachers", eleves: "students" };

/** Photo d'un enseignant ou d'un élève. */
export async function GET(req: Request, ctx: RouteContext<"/photos/[kind]/[schoolId]/[id]">) {
  const { kind, schoolId, id } = await ctx.params;
  const resource = KINDS[kind];
  if (!resource) return new Response(null, { status: 404 });
  return relayImage(req, `/schools/${encodeURIComponent(schoolId)}/${resource}/${encodeURIComponent(id)}/photo`);
}
