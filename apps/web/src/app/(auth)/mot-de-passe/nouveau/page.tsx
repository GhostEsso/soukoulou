"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { resetPassword } from "../../actions";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [state, action] = useActionState(resetPassword, undefined);
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <Field
        label="Nouveau mot de passe"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="8 caractères minimum."
      />
      <Field label="Confirmer" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
      <SubmitButton pendingLabel="Enregistrement…" className="w-full">
        Enregistrer
      </SubmitButton>
    </form>
  );
}

export default function NewPasswordPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Nouveau mot de passe</h1>
      <Suspense>
        <ResetForm />
      </Suspense>
    </div>
  );
}
