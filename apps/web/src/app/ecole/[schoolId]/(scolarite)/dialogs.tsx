"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { toast } from "sonner";
import { FormMessage, SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ActionState } from "@/lib/api";
import { removeItem } from "./actions";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

/** Le succès ferme la fenêtre et affiche un toast ; une erreur reste dans la fenêtre avec la saisie. */
function useClosingAction(action: Action, setOpen: (v: boolean) => void) {
  return useActionState<ActionState, FormData>(async (prev, form) => {
    const r = await action(prev, form);
    if (r?.ok) {
      setOpen(false);
      toast.success(r.message);
    }
    return r;
  }, undefined);
}

/** Formulaire d'édition dans une fenêtre. `children` reçoit les valeurs saisies après une erreur. */
export function EditDialog({
  trigger,
  title,
  description,
  action,
  children,
  submitLabel = "Enregistrer",
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  action: Action;
  children: (values: Record<string, string>) => React.ReactNode;
  submitLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useClosingAction(action, setOpen);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form action={formAction} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <FormMessage state={state?.ok ? undefined : state} />
          {children(state?.ok ? {} : (state?.values ?? {}))}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <SubmitButton size="default" pendingLabel="Enregistrement…">
              {submitLabel}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Suppression confirmée. L'API refuse proprement si l'élément est encore utilisé (message affiché). */
export function DeleteButton({
  schoolId,
  kind,
  id,
  label,
  warning,
  redirectTo,
  trigger,
}: {
  schoolId: string;
  kind: "year" | "level" | "subject" | "classroom" | "student" | "teacher" | "slot" | "assessment" | "parent" | "myAssessment" | "announcement" | "discipline";
  id: string;
  label: string;
  warning: string;
  /** Page à ouvrir après suppression (depuis la fiche de l'élément supprimé). */
  redirectTo?: string;
  /** Bouton déclencheur (icône corbeille par défaut). */
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useClosingAction(removeItem.bind(null, schoolId, kind, id, redirectTo), setOpen);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="icon" variant="ghost" aria-label={`Supprimer ${label}`}>
            <Trash2 aria-hidden />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form action={formAction} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Supprimer « {label} » ?</DialogTitle>
            <DialogDescription>{warning}</DialogDescription>
          </DialogHeader>
          <FormMessage state={state?.ok ? undefined : state} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <SubmitButton size="default" variant="destructive" pendingLabel="Suppression…">
              Supprimer
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Bouton d'action immédiate (sans saisie) : toast au succès comme à l'erreur. */
export function ActionButton({
  action,
  children,
  ...rest
}: { action: (prev: ActionState) => Promise<ActionState> } & Omit<
  React.ComponentProps<typeof SubmitButton>,
  "action"
>) {
  const [, formAction] = useActionState<ActionState, FormData>(async (prev) => {
    const r = await action(prev);
    if (r?.error) toast.error(r.error);
    else if (r?.message) toast.success(r.message);
    return r;
  }, undefined);
  return (
    <form action={formAction} className="contents">
      <SubmitButton size="sm" variant="outline" {...rest}>
        {children}
      </SubmitButton>
    </form>
  );
}
