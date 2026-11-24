import { relayImage } from "@/lib/relay-image";

/** Logo d'une école. */
export async function GET(req: Request, ctx: RouteContext<"/photos/logo/[schoolId]">) {
  const { schoolId } = await ctx.params;
  return relayImage(req, `/schools/${encodeURIComponent(schoolId)}/logo`);
}
