"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { forgotPassword } from "../actions";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(forgotPassword, undefined);
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Mot de passe oublié</h1>
        <p className="text-sm text-muted-foreground">
          Indiquez votre email : vous recevrez un lien pour choisir un nouveau mot de passe.
        </p>
      </div>
      <form action={action} className="grid gap-5">
        <FormMessage state={state} />
        {!state?.ok && (
          <>
            <Field label="Email" name="email" type="email" autoComplete="email" required autoFocus />
            <SubmitButton pendingLabel="Envoi…" className="w-full">
              Envoyer le lien
            </SubmitButton>
          </>
        )}
      </form>
      <Link href="/connexion" className="text-sm font-medium text-primary hover:underline">
        ← Retour à la connexion
      </Link>
    </div>
  );
}
