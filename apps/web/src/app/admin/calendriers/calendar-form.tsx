"use client";

import { Trash2 } from "lucide-react";
import { useActionState } from "react";
import { Field, FormMessage, SelectField, SubmitButton } from "@/components/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { COUNTRIES } from "@/lib/format";
import { createCalendar, deleteCalendar } from "../actions";

export function CalendarForm() {
  const [state, action] = useActionState(createCalendar, undefined);
  const v = state?.ok ? {} : (state?.values ?? {});
  return (
    <form action={action} className="space-y-4 self-start rounded-xl border p-5">
      <h2 className="text-lg font-semibold">Ajouter une année</h2>
      <FormMessage state={state} />
      <SelectField label="Pays" name="country" required defaultValue={v.country ?? "TG"} options={Object.entries(COUNTRIES)} />
      <Field
        label="Année"
        name="schoolYearLabel"
        required
        pattern="\d{4}-\d{4}"
        placeholder="2027-2028"
        defaultValue={v.schoolYearLabel}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Rentrée" name="startsOn" type="date" required defaultValue={v.startsOn} />
        <Field label="Fin des cours" name="endsOn" type="date" required defaultValue={v.endsOn} />
      </div>
      <SubmitButton size="default" pendingLabel="Ajout…">
        Ajouter
      </SubmitButton>
    </form>
  );
}

export function DeleteCalendar({ id, label }: { id: string; label: string }) {
  const [state, action] = useActionState(deleteCalendar.bind(null, id), undefined);
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label={`Supprimer ${label}`}>
          <Trash2 aria-hidden />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer l’année {label} ?</AlertDialogTitle>
          <AlertDialogDescription>
            Sans année scolaire, les écoles de ce pays ne passeront plus automatiquement en lecture seule pendant les vacances.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <FormMessage state={state} />
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <form action={action}>
            <AlertDialogAction type="submit" className="bg-destructive text-white hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
