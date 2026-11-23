"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { confirmTransfer } from "../actions";

export function ConfirmButton({ paymentId }: { paymentId: string }) {
  const [state, action] = useActionState(confirmTransfer.bind(null, paymentId), undefined);
  return (
    <form action={action} className="inline-flex flex-col items-end gap-1">
      <SubmitButton size="sm" pendingLabel="Confirmation…">
        Confirmer la réception
      </SubmitButton>
      {state?.error && <FormMessage state={state} />}
    </form>
  );
}
