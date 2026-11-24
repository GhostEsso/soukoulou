"use server";

import { revalidatePath } from "next/cache";
import { api, ApiError, formValues, type ActionState } from "@/lib/api";

const id = encodeURIComponent;
const fees = (schoolId: string, path = "") => `/schools/${id(schoolId)}/fees${path}`;

async function run(schoolId: string, fn: () => Promise<unknown>, success: string, form?: FormData): Promise<ActionState> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message, values: form ? formValues(form) : undefined };
    throw e;
  }
  revalidatePath(`/ecole/${schoolId}/frais`, "layout");
  return { ok: true, message: success };
}

/** Entier en FCFA : les espaces (milliers) sont ignorés ; NaN si la saisie n'est pas un entier. */
const amount = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(/[\s  ]/g, "") || NaN);

/** Grille : champs `level_<id>`, `amount_<i>` et `due_<i>` (i = 0, 1, …). */
function scheduleBody(yearId: string, form: FormData) {
  const lines: { amount: number; dueOn: string }[] = [];
  for (let i = 0; form.has(`amount_${i}`); i++) {
    lines.push({ amount: amount(form.get(`amount_${i}`)), dueOn: String(form.get(`due_${i}`) ?? "") });
  }
  const audience = String(form.get("sex") ?? "ALL");
  return {
    yearId,
    label: String(form.get("label") ?? "").trim() || undefined,
    sex: audience === "ALL" ? null : audience,
    levelIds: [...form.keys()].filter((k) => k.startsWith("level_")).map((k) => k.slice(6)),
    lines,
  };
}

export async function createSchedule(schoolId: string, yearId: string, _: ActionState, form: FormData) {
  return run(schoolId, () => api(fees(schoolId, "/schedules"), { method: "POST", json: scheduleBody(yearId, form) }), "Règle ajoutée.", form);
}

export async function updateSchedule(schoolId: string, yearId: string, scheduleId: string, _: ActionState, form: FormData) {
  return run(
    schoolId,
    () => api(fees(schoolId, `/schedules/${id(scheduleId)}`), { method: "PATCH", json: scheduleBody(yearId, form) }),
    "Règle modifiée.",
    form,
  );
}

export async function deleteSchedule(schoolId: string, scheduleId: string, _?: ActionState): Promise<ActionState> {
  return run(schoolId, () => api(fees(schoolId, `/schedules/${id(scheduleId)}`), { method: "DELETE" }), "Règle supprimée.");
}

/** Encaissement en espèces : renvoie l'identifiant du paiement pour ouvrir le reçu. */
export async function collectCash(schoolId: string, studentId: string, _: ActionState, form: FormData): Promise<ActionState> {
  let paymentId = "";
  const r = await run(
    schoolId,
    async () => {
      const p = await api<{ id: string }>(fees(schoolId, "/payments"), { method: "POST", json: { studentId, amount: amount(form.get("amount")) } });
      paymentId = p.id;
    },
    "Encaissement enregistré.",
    form,
  );
  return r?.ok ? { ...r, values: { paymentId } } : r;
}

export async function requestPayout(schoolId: string, _: ActionState, form: FormData) {
  return run(
    schoolId,
    () =>
      api(fees(schoolId, "/payouts"), {
        method: "POST",
        json: { amount: amount(form.get("amount")), destination: String(form.get("destination") ?? "").trim() },
      }),
    "Demande de décaissement envoyée.",
    form,
  );
}
