"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/api";
import { dayLabel, FEE_METHODS, money } from "@/lib/format";
import type { ChildFees } from "@/lib/types";
import { simulateFeePayment, startFeePayment } from "./fee-actions";

/** Tranches, solde et paiement des frais de scolarité d'un enfant. `dev` : bouton de simulation du prestataire. */
export function FeesPanel({ schoolId, studentId, fees, dev }: { schoolId: string; studentId: string; fees: ChildFees; dev: boolean }) {
  const due = fees.lines.reduce((n, l) => n + l.amount, 0);
  const remaining = due - fees.lines.reduce((n, l) => n + l.paid, 0);
  const next = fees.lines.find((l) => l.remaining > 0);
  const [sim, setSim] = useState<ActionState>();
  const [state, action] = useActionState<ActionState, FormData>((prev, form) => {
    setSim(undefined); // nouveau paiement : l'ancienne simulation ne doit pas masquer son attente
    return startFeePayment(schoolId, studentId, prev, form);
  }, undefined);
  const [simulating, start] = useTransition();
  const ref = state?.ok ? state.values?.providerRef : undefined;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {fees.label} · reste à payer <strong className="text-foreground tabular-nums">{money(remaining)}</strong> sur {money(due)}
      </p>
      <ul className="divide-y rounded-lg border text-sm">
        {fees.lines.map((l) => (
          <li key={l.position} className="flex items-center justify-between gap-3 px-3 py-2">
            <span>
              <span className="block font-medium tabular-nums">{money(l.amount)}</span>
              <span className="text-muted-foreground">avant le {dayLabel(l.dueOn)}</span>
            </span>
            {l.remaining === 0 ? <StatusBadge tone="success">Payée</StatusBadge> : l.overdue ? <StatusBadge tone="danger">En retard · {money(l.remaining)}</StatusBadge> : <StatusBadge tone="info">Reste {money(l.remaining)}</StatusBadge>}
          </li>
        ))}
      </ul>

      {remaining > 0 && fees.canPay && (!ref || sim?.ok) && (
        // key : la saisie reprend le reste de la tranche en cours après chaque changement de solde.
        <form key={`${next?.position}-${remaining}`} action={action} className="grid gap-3">
          <FormMessage state={state} />
          <Field label="Montant à payer (FCFA)" name="amount" inputMode="numeric" required defaultValue={(!state?.ok && state?.values?.amount) || String(next?.remaining ?? remaining)} />
          <SubmitButton size="default" pendingLabel="Ouverture du paiement…" className="justify-self-start">
            Payer
          </SubmitButton>
        </form>
      )}
      {remaining > 0 && !fees.canPay && <p className="text-sm text-muted-foreground">Paiement en ligne bientôt disponible : réglez à la caisse de l’école.</p>}
      {ref && !sim?.ok && (
        <div className="space-y-3 rounded-lg border bg-muted/40 p-3 text-sm">
          <p className="font-medium">Paiement en attente de confirmation</p>
          <p className="text-muted-foreground">Le solde sera mis à jour dès que le paiement est confirmé.</p>
          {dev && (
            <Button
              variant="outline"
              size="sm"
              disabled={simulating}
              onClick={() => start(async () => setSim(await simulateFeePayment(schoolId, ref)))}
            >
              {simulating && <Loader2 className="animate-spin" aria-hidden />}
              Simuler le paiement
            </Button>
          )}
          {sim?.error && <FormMessage state={sim} />}
        </div>
      )}
      {sim?.ok && <FormMessage state={sim} />}

      {fees.payments.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-sm font-medium">Paiements</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {[...fees.payments].reverse().map((p) => (
              <li key={p.id} className="flex justify-between gap-3">
                <span>
                  {dayLabel(p.paidAt)} · {FEE_METHODS[p.method]}
                </span>
                <span className="font-medium text-foreground tabular-nums">{money(p.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
