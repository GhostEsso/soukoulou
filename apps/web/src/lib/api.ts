import "server-only";
import { cookies, headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";
import { apiHeaders } from "./api-headers";
import { ACCESS_COOKIE } from "./session";

export const API_URL = process.env.API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Traduit les messages techniques de l'API en français lisible. */
export const DENIALS: Record<string, string> = {
  DISCOVERY: "Disponible après l’upgrade.",
  SUSPENDED: "Votre école est suspendue.",
  READ_ONLY: "Votre école est en lecture seule pendant les vacances.",
  PLAN: "Cette fonctionnalité n’est pas incluse dans votre offre.",
  NOT_VERIFIED: "Disponible après la validation de vos pièces.",
  DOCUMENT_OVERDUE: "Une pièce justificative est en retard.",
};

function messageOf(body: unknown, status: number): string {
  const m = (body as { message?: unknown } | null)?.message;
  const raw = Array.isArray(m) ? String(m[0]) : typeof m === "string" ? m : "";
  if (DENIALS[raw]) return DENIALS[raw];
  if (status >= 500 || !raw) return "Une erreur est survenue. Réessayez dans un instant.";
  if (status === 400 && Array.isArray(m)) return "Certaines informations sont invalides. Vérifiez le formulaire.";
  return raw;
}

/**
 * Appelle l'API avec le jeton de la session.
 * Le jeton est rafraîchi en amont par src/proxy.ts. Un 401 renvoie vers la connexion.
 */
export async function api<T>(
  path: string,
  init: RequestInit & { json?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { json, auth = true, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (json !== undefined) headers.set("Content-Type", "application/json");
  if (auth) {
    const token = (await cookies()).get(ACCESS_COOKIE)?.value;
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  for (const [k, v] of Object.entries(apiHeaders((await nextHeaders()).get("x-forwarded-for")))) headers.set(k, v);

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });

  if (res.status === 401 && auth) redirect("/connexion");
  const text = await res.text();
  const body: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, messageOf(body, res.status));
  return body as T;
}

/** Résultat standard d'une action de formulaire. */
export type ActionState =
  | { ok?: boolean; error?: string; message?: string; values?: Record<string, string> }
  | undefined;

/** Valeurs saisies, renvoyées avec une erreur pour ne rien perdre (mots de passe exclus). */
export function formValues(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form) {
    if (typeof v === "string" && !/password|confirm|^\$ACTION/.test(k)) out[k] = v;
  }
  return out;
}

export async function tryAction(fn: () => Promise<unknown>, success?: string): Promise<ActionState> {
  try {
    await fn();
    return { ok: true, message: success };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e; // redirect() et erreurs inattendues
  }
}
