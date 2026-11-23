"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { api, ApiError, formValues, type ActionState } from "@/lib/api";
import { REFRESH_COOKIE, accessCookie, refreshCookie, type Tokens } from "@/lib/session";

async function openSession(tokens: Tokens) {
  const jar = await cookies();
  jar.set(accessCookie(tokens.accessToken));
  jar.set(refreshCookie(tokens.refreshToken));
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Passe par /espace, qui ne suit `suite` que si la page appartient à l'un des espaces du compte. */
const safeNext = (v: string) =>
  v.startsWith("/") && !v.startsWith("//") && v !== "/espace" ? `/espace?suite=${encodeURIComponent(v)}` : "/espace";

export async function login(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const tokens = await api<Tokens>("/auth/login", {
      method: "POST",
      auth: false,
      json: { identifier: str(form, "identifier"), password: String(form.get("password") ?? "") },
    });
    await openSession(tokens);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message, values: formValues(form) };
    throw e;
  }
  redirect(safeNext(str(form, "suite")));
}

export async function signup(_: ActionState, form: FormData): Promise<ActionState> {
  const email = str(form, "email");
  try {
    await api("/public/schools/signup", {
      method: "POST",
      auth: false,
      json: {
        schoolName: str(form, "schoolName"),
        schoolType: str(form, "schoolType"),
        country: str(form, "country"),
        city: str(form, "city"),
        firstName: str(form, "firstName"),
        lastName: str(form, "lastName"),
        title: str(form, "title") || undefined,
        phone: str(form, "phone"),
        email,
        password: String(form.get("password") ?? ""),
      },
    });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message, values: formValues(form) };
    throw e;
  }
  redirect(`/inscription/merci?email=${encodeURIComponent(email)}`);
}

export async function verifyEmail(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const tokens = await api<Tokens>("/auth/verify-email", {
      method: "POST",
      auth: false,
      json: { token: str(form, "token") },
    });
    await openSession(tokens);
  } catch (e) {
    if (e instanceof ApiError) return { error: "Ce lien est invalide ou a expiré." };
    throw e;
  }
  redirect("/espace");
}

export async function forgotPassword(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await api("/auth/forgot-password", { method: "POST", auth: false, json: { email: str(form, "email") } });
    return { ok: true, message: "Si un compte existe pour cet email, un lien vient d’y être envoyé (valable 1 h)." };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
}

export async function resetPassword(_: ActionState, form: FormData): Promise<ActionState> {
  const password = String(form.get("password") ?? "");
  if (password !== String(form.get("confirm") ?? "")) {
    return { error: "Les deux mots de passe ne correspondent pas." };
  }
  try {
    await api("/auth/reset-password", {
      method: "POST",
      auth: false,
      json: { token: str(form, "token"), password },
    });
  } catch (e) {
    if (e instanceof ApiError) return { error: "Ce lien est invalide ou a expiré. Refaites une demande." };
    throw e;
  }
  redirect("/connexion?reinitialise=1");
}

/** Premier mot de passe (après le code remis par l'école) ou changement volontaire. */
export async function changePassword(_: ActionState, form: FormData): Promise<ActionState> {
  const password = String(form.get("password") ?? "");
  if (password !== String(form.get("confirm") ?? "")) {
    return { error: "Les deux mots de passe ne correspondent pas." };
  }
  try {
    const tokens = await api<Tokens>("/auth/change-password", {
      method: "POST",
      json: { current: String(form.get("current") ?? ""), password },
    });
    await openSession(tokens);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  redirect("/espace");
}

export async function logout() {
  const jar = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    await api("/auth/logout", { method: "POST", auth: false, json: { refreshToken } }).catch(() => undefined);
  }
  jar.delete("sk_at");
  jar.delete(REFRESH_COOKIE);
  redirect("/connexion");
}
