"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { FEATURE_LABELS } from "@/lib/format";
import type { Plan } from "@/lib/types";
import { updatePlan } from "../actions";

export function PlanForm({ plan }: { plan: Plan }) {
  const [state, action] = useActionState(updatePlan.bind(null, plan.id), undefined);
  const id = (k: string) => `${plan.id}-${k}`;
  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border p-5">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{plan.code}</p>
      <FormMessage state={state} />
      <Field id={id("name")} label="Nom" name="name" required defaultValue={plan.name} />
      <div className="grid grid-cols-2 gap-3">
        <Field
          id={id("price")}
          label="Prix mensuel (FCFA)"
          name="priceMonthly"
          type="number"
          min={0}
          step={500}
          required
          defaultValue={plan.priceMonthly}
        />
        <Field
          id={id("free")}
          label="Mois offerts / an"
          name="schoolYearFreeMonths"
          type="number"
          min={0}
          max={7}
          required
          defaultValue={plan.schoolYearFreeMonths}
          hint={`Sur ${plan.schoolYearMonths} mois`}
        />
      </div>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Fonctions incluses</legend>
        {Object.entries(FEATURE_LABELS).map(([key, label]) => (
          <label key={key} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="features"
              value={key}
              defaultChecked={plan.features.includes(key)}
              className="mt-0.5 size-4 accent-[var(--brand)]"
            />
            {label}
          </label>
        ))}
      </fieldset>
      <SubmitButton size="default" pendingLabel="Enregistrement…" className="mt-auto self-start">
        Enregistrer
      </SubmitButton>
    </form>
  );
}
