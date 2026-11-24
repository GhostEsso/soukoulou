"use server";

import { revalidatePath } from "next/cache";
import { api, ApiError, formValues, type ActionState } from "@/lib/api";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const id = encodeURIComponent;

async function run(fn: () => Promise<unknown>, success?: string, form?: FormData): Promise<ActionState> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message, values: form ? formValues(form) : undefined };
    throw e;
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message: success };
}

const post = (path: string, json?: unknown) => api(path, { method: "POST", json });

// ── Alertes ────────────────────────────────────────────
export async function readAlert(alertId: string) {
  await run(() => post(`/platform/alerts/${id(alertId)}/read`));
}

// ── Vérifications ──────────────────────────────────────
export async function reviewDocument(
  schoolId: string,
  documentId: string,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const status = str(form, "status");
  const comment = str(form, "comment");
  if (status === "REJECTED" && comment.length < 3) {
    return { error: "Expliquez à l’école ce qui ne va pas.", values: formValues(form) };
  }
  return run(
    () =>
      post(`/platform/verifications/${id(schoolId)}/documents/${id(documentId)}/review`, {
        status,
        comment: comment || undefined,
      }),
    status === "ACCEPTED" ? "Pièce conforme." : "Pièce refusée.",
    form,
  );
}

export async function approve(schoolId: string, _: ActionState): Promise<ActionState> {
  return run(() => post(`/platform/verifications/${id(schoolId)}/approve`), "École vérifiée. Ses fonctions sont débloquées.");
}

export async function requestChanges(schoolId: string, _: ActionState, form: FormData): Promise<ActionState> {
  return run(
    () => post(`/platform/verifications/${id(schoolId)}/request-changes`, { message: str(form, "message") }),
    "Demande de correction envoyée à l’école.",
    form,
  );
}

export async function reject(schoolId: string, _: ActionState, form: FormData): Promise<ActionState> {
  return run(
    () => post(`/platform/verifications/${id(schoolId)}/reject`, { reason: str(form, "reason") }),
    "Dossier refusé.",
    form,
  );
}

// ── Paiements ──────────────────────────────────────────
export async function confirmTransfer(paymentId: string, _: ActionState): Promise<ActionState> {
  return run(() => post(`/platform/payments/${id(paymentId)}/confirm`), "Paiement confirmé. Abonnement activé.");
}

// ── Écoles ─────────────────────────────────────────────
export async function suspend(schoolId: string, _: ActionState, form: FormData): Promise<ActionState> {
  return run(
    () => post(`/platform/schools/${id(schoolId)}/suspend`, { reason: str(form, "reason") }),
    "École suspendue.",
    form,
  );
}

export async function reactivate(schoolId: string, _: ActionState): Promise<ActionState> {
  return run(() => post(`/platform/schools/${id(schoolId)}/reactivate`), "École réactivée.");
}

// ── Catalogue de pièces ────────────────────────────────
const lines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

export async function createRequirement(_: ActionState, form: FormData): Promise<ActionState> {
  const appliesToExisting = form.get("appliesToExisting") === "on";
  const due = str(form, "dueDate");
  if (appliesToExisting && !due) {
    return { error: "Fixez une date limite pour les écoles déjà inscrites.", values: formValues(form) };
  }
  return run(
    () =>
      post("/platform/document-requirements", {
        name: str(form, "name"),
        description: str(form, "description") || undefined,
        isMandatory: form.get("isMandatory") === "on",
        acceptedMimeTypes: form.getAll("mime").map(String),
        maxSizeBytes: Number(str(form, "maxMb") || 5) * 1_048_576,
        countries: form.getAll("countries").map(String),
        schoolTypes: form.getAll("schoolTypes").map(String),
        ownerships: form.getAll("ownerships").map(String),
        checkpoints: lines(str(form, "checkpoints")),
        appliesToExisting,
        dueDate: appliesToExisting ? new Date(`${due}T23:59:59`).toISOString() : undefined,
      }),
    "Pièce ajoutée au catalogue.",
    form,
  );
}

export async function toggleRequirement(requirementId: string, isActive: boolean) {
  return run(
    () => api(`/platform/document-requirements/${id(requirementId)}`, { method: "PATCH", json: { isActive } }),
    isActive ? "Pièce réactivée." : "Pièce désactivée.",
  );
}

// ── Offres ─────────────────────────────────────────────
export async function updatePlan(planId: string, _: ActionState, form: FormData): Promise<ActionState> {
  return run(
    () =>
      api(`/platform/plans/${id(planId)}`, {
        method: "PATCH",
        json: {
          name: str(form, "name"),
          priceMonthly: Number(str(form, "priceMonthly")),
          schoolYearFreeMonths: Number(str(form, "schoolYearFreeMonths")),
          features: form.getAll("features").map(String),
        },
      }),
    "Offre mise à jour.",
    form,
  );
}

// ── Calendriers ────────────────────────────────────────
export async function createCalendar(_: ActionState, form: FormData): Promise<ActionState> {
  return run(
    () =>
      post("/platform/calendars", {
        country: str(form, "country"),
        schoolYearLabel: str(form, "schoolYearLabel"),
        startsOn: str(form, "startsOn"),
        endsOn: str(form, "endsOn"),
      }),
    "Année scolaire ajoutée.",
    form,
  );
}

export async function deleteCalendar(calendarId: string, _: ActionState): Promise<ActionState> {
  return run(() => api(`/platform/calendars/${id(calendarId)}`, { method: "DELETE" }), "Année scolaire supprimée.");
}

// ── Décaissements ──────────────────────────────────────
export async function markPayoutPaid(payoutId: string, _: ActionState, form: FormData): Promise<ActionState> {
  return run(() => post(`/platform/payouts/${id(payoutId)}/paid`, { providerRef: str(form, "providerRef") }), "Décaissement marqué comme versé.", form);
}

export async function rejectPayout(payoutId: string, _: ActionState, form: FormData): Promise<ActionState> {
  return run(() => post(`/platform/payouts/${id(payoutId)}/reject`, { reason: str(form, "reason") }), "Demande rejetée.", form);
}
