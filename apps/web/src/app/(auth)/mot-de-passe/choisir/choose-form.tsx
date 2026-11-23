"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { changePassword } from "../../actions";

export function ChooseForm({ first }: { first: boolean }) {
  const [state, action] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="grid gap-5">
      <FormMessage state={state} />
      <Field
        label={first ? "Code reçu de l’école" : "Mot de passe actuel"}
        name="current"
        type="password"
        autoComplete="current-password"
        required
        autoFocus
      />
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
        Enregistrer et continuer
      </SubmitButton>
    </form>
  );
}
