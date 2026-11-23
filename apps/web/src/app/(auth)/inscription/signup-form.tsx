"use client";

import { useActionState } from "react";
import { Field, FormMessage, SelectField, SubmitButton } from "@/components/form";
import { COUNTRIES, SCHOOL_TYPES } from "@/lib/format";
import { signup } from "../actions";

export function SignupForm() {
  const [state, action] = useActionState(signup, undefined);
  const v = state?.values ?? {};
  return (
    <form action={action} className="grid gap-6">
      <FormMessage state={state} />

      <fieldset className="grid gap-4">
        <legend className="mb-1 text-sm font-semibold">L’école</legend>
        <Field label="Nom de l’établissement" name="schoolName" required minLength={2} defaultValue={v.schoolName} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Type"
            name="schoolType"
            required
            defaultValue={v.schoolType}
            options={Object.entries(SCHOOL_TYPES)}
          />
          <SelectField
            label="Pays"
            name="country"
            required
            defaultValue={v.country ?? "TG"}
            options={Object.entries(COUNTRIES)}
          />
        </div>
        <Field label="Ville" name="city" required defaultValue={v.city} />
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-1 text-sm font-semibold">Vous, le responsable</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prénom" name="firstName" autoComplete="given-name" required defaultValue={v.firstName} />
          <Field label="Nom" name="lastName" autoComplete="family-name" required defaultValue={v.lastName} />
        </div>
        <Field
          label="Fonction (facultatif)"
          name="title"
          placeholder="Fondateur, directeur…"
          defaultValue={v.title}
        />
        <Field
          label="Téléphone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+228 90 00 00 00"
          required
          minLength={6}
          defaultValue={v.phone}
        />
        <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={v.email} />
        <Field
          label="Mot de passe"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          hint="8 caractères minimum."
        />
      </fieldset>

      <p className="text-xs text-muted-foreground">
        En créant le compte, vous acceptez les conditions d’utilisation de Soukoulou.
      </p>
      <SubmitButton pendingLabel="Création du compte…" className="w-full">
        Créer mon compte
      </SubmitButton>
    </form>
  );
}
