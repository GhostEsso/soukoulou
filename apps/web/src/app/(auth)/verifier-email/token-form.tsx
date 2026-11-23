"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { verifyEmail } from "../actions";

export function TokenForm({ token }: { token: string }) {
  const [state, action] = useActionState(verifyEmail, undefined);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Confirmation…" className="w-full">
        Confirmer mon email
      </SubmitButton>
    </form>
  );
}
