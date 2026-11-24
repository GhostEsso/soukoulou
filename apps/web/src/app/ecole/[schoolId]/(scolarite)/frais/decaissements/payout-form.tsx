"use client";

import { useActionState, useRef } from "react";
import { toast } from "sonner";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import type { ActionState } from "@/lib/api";
import { requestPayout } from "../actions";

export function PayoutForm({ schoolId, available }: { schoolId: string; available: number }) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState<ActionState, FormData>(async (prev, form) => {
    const r = await requestPayout(schoolId, prev, form);
    if (r?.ok) {
      toast.success(r.message);
      ref.current?.reset();
    }
    return r;
  }, undefined);
  return (
    <form ref={ref} action={action} className="grid gap-4 sm:max-w-md">
      <FormMessage state={state?.ok ? undefined : state} />
      <Field label="Montant (FCFA)" name="amount" inputMode="numeric" required defaultValue={state?.values?.amount} hint={`Disponible : ${available.toLocaleString("fr-FR")} FCFA`} />
      <Field label="Numéro Mobile Money ou RIB" name="destination" required defaultValue={state?.values?.destination} placeholder="+228 90 00 00 00" />
      <SubmitButton size="default" disabled={available <= 0} pendingLabel="Envoi…" className="justify-self-start">
        Demander le décaissement
      </SubmitButton>
    </form>
  );
}
