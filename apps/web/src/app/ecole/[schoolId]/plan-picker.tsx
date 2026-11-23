"use client";

import { Check, CreditCard, Landmark, Loader2, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import { FEATURE_LABELS, money } from "@/lib/format";
import type { BillingCycle, PaymentMethod, Plan } from "@/lib/types";
import { cn } from "@/lib/utils";
import { checkout, simulatePayment } from "./actions";

const METHODS: { value: PaymentMethod; label: string; hint: string; icon: typeof Smartphone }[] = [
  { value: "MOBILE_MONEY", label: "Mobile Money", hint: "Flooz, T-Money…", icon: Smartphone },
  { value: "CARD", label: "Carte bancaire", hint: "Visa, Mastercard", icon: CreditCard },
  { value: "TRANSFER", label: "Virement ou dépôt", hint: "Confirmé par Soukoulou", icon: Landmark },
];

const total = (p: Plan, c: BillingCycle) =>
  c === "MONTHLY" ? p.priceMonthly : p.priceMonthly * (p.schoolYearMonths - p.schoolYearFreeMonths);

export function PlanPicker({
  schoolId,
  plans,
  lockedPlanCode,
  devPayments,
}: {
  schoolId: string;
  plans: Plan[];
  /** Pendant un abonnement actif, on ne peut que renouveler la même offre. */
  lockedPlanCode?: string;
  devPayments: boolean;
}) {
  const router = useRouter();
  const [state, action] = useActionState(checkout.bind(null, schoolId), undefined);
  const [cycle, setCycle] = useState<BillingCycle>("SCHOOL_YEAR");
  const [planCode, setPlanCode] = useState(lockedPlanCode ?? plans[1]?.code ?? plans[0]?.code);
  const [method, setMethod] = useState<PaymentMethod>("MOBILE_MONEY");
  const [simulating, startSimulate] = useTransition();
  const [simError, setSimError] = useState<string>();
  const plan = plans.find((p) => p.code === planCode);
  const visible = lockedPlanCode ? plans.filter((p) => p.code === lockedPlanCode) : plans;

  if (state?.payment) {
    const p = state.payment;
    return (
      <div className="space-y-4 rounded-xl border p-6">
        <p className="text-sm text-muted-foreground">Montant à régler</p>
        <p className="text-3xl font-semibold tracking-tight">{money(p.amount, p.currency)}</p>
        {p.instructions ? (
          <div className="rounded-lg bg-muted p-4 text-sm">
            <p className="font-medium">Instructions de virement</p>
            <p className="mt-1 text-muted-foreground">{p.instructions}</p>
            <p className="mt-3 text-muted-foreground">
              Votre abonnement sera activé dès que Soukoulou aura confirmé la réception. Vous recevrez un email.
            </p>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Validez le paiement sur votre téléphone ou la page de votre banque. Cette page se mettra à jour.</p>
            {devPayments && (
              <div className="rounded-lg border border-dashed p-3">
                <p className="mb-2 text-xs">Environnement de développement : aucun prestataire réel n’est branché.</p>
                <Button
                  variant="outline"
                  disabled={simulating}
                  onClick={() =>
                    startSimulate(async () => {
                      const r = await simulatePayment(schoolId, p.paymentId);
                      if (r?.error) setSimError(r.error);
                      else router.push(`/ecole/${schoolId}`);
                    })
                  }
                >
                  {simulating && <Loader2 className="animate-spin" aria-hidden />}
                  Simuler la confirmation du paiement
                </Button>
                {simError && <FormMessage state={{ error: simError }} />}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="planCode" value={planCode} />
      <input type="hidden" name="billingCycle" value={cycle} />
      <input type="hidden" name="method" value={method} />
      <FormMessage state={state} />

      <div
        role="radiogroup"
        aria-label="Durée"
        className="inline-flex rounded-lg border bg-muted p-1 text-sm"
      >
        {(
          [
            ["SCHOOL_YEAR", "Année scolaire", "1 mois offert"],
            ["MONTHLY", "Mensuel", null],
          ] as const
        ).map(([value, label, tag]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={cycle === value}
            onClick={() => setCycle(value)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 font-medium transition-colors",
              cycle === value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            {tag && <span className="rounded-full bg-success/10 px-1.5 py-0.5 text-[11px] text-success">{tag}</span>}
          </button>
        ))}
      </div>

      <div role="radiogroup" aria-label="Offre" className="grid gap-4 md:grid-cols-3">
        {visible.map((p) => {
          const selected = p.code === planCode;
          const months = p.schoolYearMonths - p.schoolYearFreeMonths;
          return (
            <button
              key={p.code}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPlanCode(p.code)}
              className={cn(
                "relative flex flex-col rounded-xl border p-5 text-left transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                selected ? "border-primary ring-1 ring-primary" : "hover:border-foreground/20",
              )}
            >
              {p.code === "STANDARD" && !lockedPlanCode && (
                <span className="absolute -top-2.5 left-5 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                  Le plus choisi
                </span>
              )}
              <span className="flex items-center justify-between">
                <span className="font-semibold">{p.name}</span>
                <span
                  className={cn(
                    "grid size-5 place-items-center rounded-full border",
                    selected && "border-primary bg-primary text-primary-foreground",
                  )}
                  aria-hidden
                >
                  {selected && <Check className="size-3" />}
                </span>
              </span>
              <span className="mt-3 text-2xl font-semibold tracking-tight">{money(p.priceMonthly, p.currency)}</span>
              <span className="text-xs text-muted-foreground">
                par mois
                {cycle === "SCHOOL_YEAR" && ` · ${money(total(p, cycle), p.currency)} pour l’année (${months} mois payés)`}
              </span>
              <ul className="mt-4 space-y-1.5 border-t pt-4 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    <span>{FEATURE_LABELS[f] ?? f}</span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <fieldset>
        <legend className="mb-3 text-sm font-semibold">Moyen de paiement</legend>
        <div role="radiogroup" aria-label="Moyen de paiement" className="grid gap-3 sm:grid-cols-3">
          {METHODS.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={method === m.value}
              onClick={() => setMethod(m.value)}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                method === m.value ? "border-primary bg-accent/50" : "hover:border-foreground/20",
              )}
            >
              <m.icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span>
                <span className="block text-sm font-medium">{m.label}</span>
                <span className="block text-xs text-muted-foreground">{m.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {plan && (
        <div className="flex flex-col gap-4 rounded-xl bg-muted/60 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {plan.name} · {cycle === "SCHOOL_YEAR" ? "année scolaire" : "1 mois"}
            </p>
            <p className="text-2xl font-semibold tracking-tight">{money(total(plan, cycle), plan.currency)}</p>
          </div>
          <SubmitButton pendingLabel="Préparation…">Payer {money(total(plan, cycle), plan.currency)}</SubmitButton>
        </div>
      )}
    </form>
  );
}
