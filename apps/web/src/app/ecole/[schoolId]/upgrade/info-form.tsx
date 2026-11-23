"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { Field, FormMessage, SelectField, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OWNERSHIPS } from "@/lib/format";
import type { School } from "@/lib/types";
import { saveInfo } from "../actions";

const suggestSlug = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export function InfoForm({ school, nextHref }: { school: School; nextHref: string }) {
  const router = useRouter();
  const [state, action] = useActionState(saveInfo.bind(null, school.id), undefined);
  useEffect(() => {
    if (state?.ok) router.push(nextHref);
  }, [state, router, nextHref]);
  const v = state?.values ?? {};
  const slugLocked = Boolean(school.slug);

  return (
    <form action={action} className="grid max-w-4xl gap-5">
      <FormMessage state={state?.ok ? undefined : state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          label="Statut de l’établissement"
          name="ownership"
          required
          defaultValue={v.ownership ?? school.ownership ?? undefined}
          options={Object.entries(OWNERSHIPS)}
        />
        <Field
          label="Numéro d’autorisation d’ouverture"
          name="authorizationNumber"
          required
          defaultValue={v.authorizationNumber ?? school.authorizationNumber ?? ""}
        />
      </div>
      <Field
        label="Adresse"
        name="address"
        required
        placeholder="Quartier, rue, repère"
        defaultValue={v.address ?? school.address ?? ""}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Téléphone de l’école"
          name="phone"
          type="tel"
          required
          defaultValue={v.phone ?? school.phone ?? ""}
        />
        <Field
          label="Email de l’école"
          name="email"
          type="email"
          required
          defaultValue={v.email ?? school.email ?? ""}
        />
      </div>
      <Field
        label="Nombre d’élèves (approximatif)"
        name="approxStudentCount"
        type="number"
        min={1}
        max={50000}
        required
        className="sm:max-w-60"
        defaultValue={v.approxStudentCount ?? school.approxStudentCount ?? ""}
      />
      <div className="grid gap-1.5">
        <Label htmlFor="desiredSlug">Adresse web de l’école</Label>
        <div className="flex h-10 items-center overflow-hidden rounded-lg border border-input shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <Input
            id="desiredSlug"
            name="desiredSlug"
            required
            readOnly={slugLocked}
            pattern="[a-z0-9][a-z0-9\-]{1,38}[a-z0-9]"
            title="Lettres minuscules, chiffres et tirets (3 à 40 caractères)."
            className="h-full rounded-none border-0 shadow-none focus-visible:ring-0"
            defaultValue={v.desiredSlug ?? school.slug ?? school.desiredSlug ?? suggestSlug(school.name)}
            aria-describedby="slug-hint"
          />
          <span className="shrink-0 border-l bg-muted px-3 text-sm text-muted-foreground leading-10">
            .soukoulou.com
          </span>
        </div>
        <p id="slug-hint" className="text-xs text-muted-foreground">
          {slugLocked
            ? "Adresse réservée : elle ne peut plus être changée."
            : "Réservée au moment du paiement. Lettres minuscules, chiffres et tirets."}
        </p>
      </div>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Enregistrement…">Enregistrer et continuer</SubmitButton>
      </div>
    </form>
  );
}
