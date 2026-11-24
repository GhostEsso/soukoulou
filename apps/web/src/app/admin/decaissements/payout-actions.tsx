"use client";

import { Check, X } from "lucide-react";
import { Field } from "@/components/form";
import { Button } from "@/components/ui/button";
import { EditDialog } from "@/app/ecole/[schoolId]/(scolarite)/dialogs";
import { markPayoutPaid, rejectPayout } from "../actions";

export function PayoutActions({ payoutId, amount, school }: { payoutId: string; amount: string; school: string }) {
  return (
    <div className="flex justify-end gap-2">
      <EditDialog
        title="Marquer comme versé"
        description={`Après avoir envoyé ${amount} à ${school}, saisissez la référence de la transaction.`}
        action={markPayoutPaid.bind(null, payoutId)}
        submitLabel="Marquer payé"
        trigger={
          <Button size="sm">
            <Check aria-hidden /> Marquer payé
          </Button>
        }
      >
        {(v) => <Field label="Référence de la transaction" name="providerRef" required defaultValue={v.providerRef} />}
      </EditDialog>
      <EditDialog
        title="Rejeter la demande"
        description="Le montant redevient disponible pour l’école. Le motif lui est communiqué."
        action={rejectPayout.bind(null, payoutId)}
        submitLabel="Rejeter"
        trigger={
          <Button size="sm" variant="outline">
            <X aria-hidden /> Rejeter
          </Button>
        }
      >
        {(v) => <Field label="Motif" name="reason" required defaultValue={v.reason} />}
      </EditDialog>
    </div>
  );
}
