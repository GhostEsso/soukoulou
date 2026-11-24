"use server";

import { createHmac } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api, ApiError, type ActionState } from "@/lib/api";

const id = encodeURIComponent;

/** Ouvre le paiement en ligne : redirige vers la page SasPay, ou (dev sans SasPay) renvoie la référence à simuler. */
export async function startFeePayment(schoolId: string, studentId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const amount = Number(String(form.get("amount") ?? "").replace(/[\s  ]/g, "") || NaN);
  let checkoutUrl: string;
  try {
    const r = await api<{ providerRef: string; checkoutUrl: string | null }>(`/schools/${id(schoolId)}/parent/children/${id(studentId)}/fees/checkout`, {
      method: "POST",
      json: { amount },
    });
    if (!r.checkoutUrl) return { ok: true, values: { providerRef: r.providerRef, amount: String(amount) } };
    checkoutUrl = r.checkoutUrl;
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message, values: { amount: String(form.get("amount") ?? "") } };
    throw e;
  }
  redirect(checkoutUrl); // hors du try : redirect lève une exception interne de Next
}

/**
 * Développement uniquement : simule la confirmation du prestataire (webhook signé).
 * ponytail: à retirer quand le vrai prestataire sera branché.
 */
export async function simulateFeePayment(schoolId: string, providerRef: string): Promise<ActionState> {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (process.env.NODE_ENV === "production" || !secret) return { error: "Simulation indisponible." };
  const body = JSON.stringify({ providerRef, status: "PAID" });
  try {
    await api("/webhooks/fee-payments", {
      method: "POST",
      auth: false,
      body,
      headers: { "Content-Type": "application/json", "x-soukoulou-signature": createHmac("sha256", secret).update(body).digest("hex") },
    });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/parent/${schoolId}`, "layout");
  return { ok: true, message: "Paiement confirmé." };
}
