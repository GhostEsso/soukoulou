"use client";

import { Banknote, Printer } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { ActionState } from "@/lib/api";
import { money } from "@/lib/format";
import { collectCash } from "./actions";

/** Encaissement espèces. Au succès la fenêtre reste ouverte et propose le reçu imprimable. */
export function CashDialog({ schoolId, studentId, remaining }: { schoolId: string; studentId: string; remaining: number }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionState, FormData>(collectCash.bind(null, schoolId, studentId), undefined);
  const paymentId = state?.ok ? state.values?.paymentId : undefined;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={remaining <= 0}>
          <Banknote aria-hidden /> Encaisser
        </Button>
      </DialogTrigger>
      <DialogContent>
        {paymentId ? (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>Encaissement enregistré</DialogTitle>
              <DialogDescription>Imprimez le reçu à remettre au parent.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Fermer
              </Button>
              <Button asChild>
                <Link href={`/impression/${schoolId}/recu/${paymentId}`} target="_blank">
                  <Printer aria-hidden /> Ouvrir le reçu
                </Link>
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Encaisser en espèces</DialogTitle>
              <DialogDescription>Reste à payer : {money(remaining)}.</DialogDescription>
            </DialogHeader>
            <FormMessage state={state} />
            <Field label="Montant reçu (FCFA)" name="amount" inputMode="numeric" required defaultValue={state?.values?.amount ?? String(remaining)} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <SubmitButton size="default" pendingLabel="Enregistrement…">
                Encaisser
              </SubmitButton>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
