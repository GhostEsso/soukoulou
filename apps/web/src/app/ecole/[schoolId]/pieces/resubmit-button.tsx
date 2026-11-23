"use client";

import { Send } from "lucide-react";
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { resubmit } from "../actions";

export function ResubmitButton({ schoolId, ready }: { schoolId: string; ready: boolean }) {
  const [state, action] = useActionState(resubmit.bind(null, schoolId), undefined);
  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <FormMessage state={state} />
      {!ready && <p className="text-xs text-muted-foreground">Remplacez d’abord toutes les pièces refusées.</p>}
      {!state?.ok && (
        <SubmitButton pendingLabel="Envoi…" disabled={!ready}>
          <Send aria-hidden /> Renvoyer le dossier
        </SubmitButton>
      )}
    </form>
  );
}
