"use server";

import { createHmac } from "node:crypto";
import { revalidatePath } from "next/cache";
import { api, ApiError, formValues, type ActionState } from "@/lib/api";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const refresh = (schoolId: string) => revalidatePath(`/ecole/${schoolId}`, "layout");
const path = (schoolId: string, rest: string) => `/schools/${encodeURIComponent(schoolId)}${rest}`;

async function run(
  schoolId: string,
  fn: () => Promise<unknown>,
  success?: string,
  form?: FormData,
): Promise<ActionState> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message, values: form ? formValues(form) : undefined };
    throw e;
  }
  refresh(schoolId);
  return { ok: true, message: success };
}

export async function saveInfo(schoolId: string, _: ActionState, form: FormData): Promise<ActionState> {
  return run(
    schoolId,
    () =>
      api(path(schoolId, "/onboarding/info"), {
        method: "PUT",
        json: {
          ownership: str(form, "ownership"),
          address: str(form, "address"),
          phone: str(form, "phone"),
          email: str(form, "email"),
          authorizationNumber: str(form, "authorizationNumber"),
          approxStudentCount: Number(str(form, "approxStudentCount")),
          desiredSlug: str(form, "desiredSlug").toLowerCase(),
        },
      }),
    "Informations enregistrées.",
    form,
  );
}

export async function uploadDocument(
  schoolId: string,
  requirementId: string,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisissez un fichier." };
  const body = new FormData();
  body.set("file", file, file.name);
  return run(
    schoolId,
    () => api(path(schoolId, `/onboarding/documents/${encodeURIComponent(requirementId)}`), { method: "PUT", body }),
    "Pièce envoyée.",
  );
}

export async function resubmit(schoolId: string, _: ActionState): Promise<ActionState> {
  return run(
    schoolId,
    () => api(path(schoolId, "/onboarding/resubmit"), { method: "POST" }),
    "Dossier renvoyé. Nous vous répondons sous 48 h ouvrées.",
  );
}

export interface CheckoutResult {
  paymentId: string;
  amount: number;
  currency: string;
  method: string;
  instructions: string | null;
}

export async function checkout(
  schoolId: string,
  _: (ActionState & { payment?: CheckoutResult }) | undefined,
  form: FormData,
): Promise<ActionState & { payment?: CheckoutResult }> {
  try {
    const payment = await api<CheckoutResult>(path(schoolId, "/subscription/checkout"), {
      method: "POST",
      json: {
        planCode: str(form, "planCode"),
        billingCycle: str(form, "billingCycle"),
        method: str(form, "method"),
      },
    });
    return { ok: true, payment, values: formValues(form) };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message, values: formValues(form) };
    throw e;
  }
}

/**
 * Développement uniquement : simule la confirmation du prestataire Mobile Money / carte.
 * ponytail: à retirer quand le vrai agrégateur sera branché.
 */
export async function simulatePayment(schoolId: string, paymentId: string): Promise<ActionState> {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (process.env.NODE_ENV === "production" || !secret) {
    return { error: "Simulation indisponible." };
  }
  const body = JSON.stringify({ providerRef: paymentId, status: "PAID" });
  return run(schoolId, () =>
    api("/webhooks/payments", {
      method: "POST",
      auth: false,
      body,
      headers: {
        "Content-Type": "application/json",
        "x-soukoulou-signature": createHmac("sha256", secret).update(body).digest("hex"),
      },
    }),
  );
}

export async function setTheme(schoolId: string, brandColor: string | null): Promise<ActionState> {
  return run(
    schoolId,
    () => api(path(schoolId, "/settings/theme"), { method: "PUT", json: { brandColor } }),
    brandColor ? "Couleur enregistrée." : "Couleur Soukoulou rétablie.",
  );
}
