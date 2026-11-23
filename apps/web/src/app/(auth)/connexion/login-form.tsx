"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { purgeUserCaches } from "@/lib/user-caches";
import { login } from "../actions";

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [state, action] = useActionState(login, notice ? { message: notice } : undefined);
  // Arrivée sur /connexion = plus de session : on efface les pages du compte précédent gardées hors ligne.
  useEffect(() => {
    if ("caches" in window) purgeUserCaches().catch(() => undefined);
  }, []);
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="suite" value={next} />
      <FormMessage state={state} />
      <Field
        label="Email, téléphone ou matricule"
        name="identifier"
        autoComplete="username"
        required
        autoFocus
        placeholder="vous@exemple.com, 90 00 00 00 ou matricule"
        defaultValue={state?.values?.identifier}
      />
      <div className="grid gap-1.5">
        <Field label="Mot de passe" name="password" type="password" autoComplete="current-password" required />
        <Link href="/mot-de-passe-oublie" className="justify-self-end text-xs font-medium text-primary hover:underline">
          Mot de passe oublié ?
        </Link>
      </div>
      <SubmitButton pendingLabel="Connexion…" className="w-full">
        Se connecter
      </SubmitButton>
    </form>
  );
}
