"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { COUNTRIES, OWNERSHIPS, SCHOOL_TYPES } from "@/lib/format";
import { createRequirement, toggleRequirement } from "../actions";

const MIMES: [string, string][] = [
  ["application/pdf", "PDF"],
  ["image/jpeg", "JPG"],
  ["image/png", "PNG"],
];

function Checks({ legend, name, options, hint }: { legend: string; name: string; options: [string, string][]; hint?: string }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{legend}</legend>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
        {options.map(([v, l]) => (
          <label key={v} className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" name={name} value={v} defaultChecked={name === "mime"} className="size-4 accent-[var(--brand)]" />
            {l}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function RequirementForm() {
  const [state, action] = useActionState(createRequirement, undefined);
  const [existing, setExisting] = useState(false);
  const v = state?.values ?? {};
  return (
    <form action={action} className="space-y-5 self-start rounded-xl border p-5 xl:sticky xl:top-20">
      <h2 className="text-lg font-semibold">Ajouter une pièce</h2>
      <FormMessage state={state} />
      <Field label="Nom" name="name" required minLength={2} maxLength={120} defaultValue={v.name} placeholder="Ex. : Attestation CNSS" />
      <div className="grid gap-1.5">
        <Label htmlFor="req-description">Explication pour l’école</Label>
        <Textarea id="req-description" name="description" maxLength={500} defaultValue={v.description} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isMandatory" defaultChecked className="size-4 accent-[var(--brand)]" />
        Obligatoire
      </label>
      <Checks legend="Formats acceptés" name="mime" options={MIMES} />
      <Field label="Taille max. (Mo)" name="maxMb" type="number" min={1} max={10} defaultValue={v.maxMb ?? "5"} className="max-w-40" />
      <Checks legend="Pays" name="countries" options={Object.entries(COUNTRIES)} hint="Aucun coché = tous les pays." />
      <Checks legend="Types d’école" name="schoolTypes" options={Object.entries(SCHOOL_TYPES)} hint="Aucun coché = tous." />
      <Checks legend="Statuts" name="ownerships" options={Object.entries(OWNERSHIPS)} hint="Aucun coché = tous." />
      <div className="grid gap-1.5">
        <Label htmlFor="req-checkpoints">Points à vérifier</Label>
        <Textarea
          id="req-checkpoints"
          name="checkpoints"
          rows={3}
          defaultValue={v.checkpoints}
          placeholder={"Un point par ligne\nNom de l’école lisible\nDocument en cours de validité"}
        />
      </div>
      <div className="space-y-3 rounded-lg bg-muted/60 p-3">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="appliesToExisting"
            checked={existing}
            onChange={(e) => setExisting(e.target.checked)}
            className="mt-0.5 size-4 accent-[var(--brand)]"
          />
          <span>
            Demander aussi aux écoles déjà inscrites
            <span className="block text-xs text-muted-foreground">
              Passé la date limite : nouvelles invitations et encaissements bloqués, rien d’autre.
            </span>
          </span>
        </label>
        {existing && <Field label="Date limite" name="dueDate" type="date" required defaultValue={v.dueDate} className="max-w-48" />}
      </div>
      <SubmitButton size="default" pendingLabel="Ajout…">
        Ajouter au catalogue
      </SubmitButton>
    </form>
  );
}

export function ToggleRequirement({ id, isActive }: { id: string; isActive: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await toggleRequirement(id, !isActive);
          if (r?.error) toast.error(r.error);
          else toast.success(r?.message);
        })
      }
    >
      {isActive ? "Désactiver" : "Réactiver"}
    </Button>
  );
}
