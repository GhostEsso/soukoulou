"use client";

import { CheckCheck } from "lucide-react";
import { useActionState, useState } from "react";
import { toast } from "sonner";
import { FormMessage, SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/api";
import type { AttendanceStatus, Roster } from "@/lib/types";
import { cn } from "@/lib/utils";
import { saveRollCall } from "../actions";

const CHOICES: { value: AttendanceStatus; label: string; plural: string; short: string; on: string }[] = [
  { value: "PRESENT", label: "Présent", plural: "Présents", short: "P", on: "bg-success text-white" },
  { value: "LATE", label: "En retard", plural: "Retards", short: "R", on: "bg-amber-500 text-white" },
  { value: "ABSENT", label: "Absent", plural: "Absents", short: "A", on: "bg-destructive text-white" },
];

/** Feuille d'appel : tout le monde présent par défaut, on ne touche que les absents et retards. */
export function RollCall({
  schoolId,
  roster,
  readOnly,
  teacher = false,
}: {
  schoolId: string;
  roster: Roster;
  readOnly: boolean;
  teacher?: boolean;
}) {
  const initial = () => Object.fromEntries(roster.students.map((s) => [s.id, s.status ?? "PRESENT"])) as Record<string, AttendanceStatus>;
  const [status, setStatus] = useState(initial);
  const [state, action] = useActionState<ActionState, FormData>(async (prev, form) => {
    const r = await saveRollCall(schoolId, roster.classroom.id, roster.day, prev, form, teacher);
    if (r?.ok) toast.success(r.message);
    return r;
  }, undefined);

  const count = (v: AttendanceStatus) => Object.values(status).filter((s) => s === v).length;

  return (
    <form action={action}>
      <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3 sm:px-5">
        {CHOICES.map((c) => (
          <span key={c.value} className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm">
            <span aria-hidden className={cn("size-2 rounded-full", c.on)} />
            {c.plural} <span className="font-semibold tabular-nums">{count(c.value)}</span>
          </span>
        ))}
        {!roster.taken && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-900">Appel pas encore fait</span>
        )}
        {!readOnly && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => setStatus(Object.fromEntries(roster.students.map((s) => [s.id, "PRESENT"])))}
          >
            <CheckCheck aria-hidden /> Tous présents
          </Button>
        )}
      </div>
      {state?.error && (
        <div className="px-4 pb-3 sm:px-5">
          <FormMessage state={state} />
        </div>
      )}
      <ul className="divide-y border-t">
        {roster.students.map((s, i) => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-2 sm:px-5">
            <span className="w-6 text-right text-xs text-muted-foreground tabular-nums">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-sm">
              <span className="font-medium">{s.lastName}</span> {s.firstName}
            </span>
            <fieldset disabled={readOnly} className="flex gap-1">
              <legend className="sr-only">
                {s.lastName} {s.firstName}
              </legend>
              {CHOICES.map((c) => (
                <label
                  key={c.value}
                  title={c.label}
                  className={cn(
                    "grid h-8 w-9 cursor-pointer place-items-center rounded-md border text-xs font-semibold transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                    status[s.id] === c.value ? cn(c.on, "border-transparent") : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <input
                    type="radio"
                    name={`s_${s.id}`}
                    value={c.value}
                    checked={status[s.id] === c.value}
                    onChange={() => setStatus((prev) => ({ ...prev, [s.id]: c.value }))}
                    className="sr-only"
                  />
                  <span aria-hidden>{c.short}</span>
                  <span className="sr-only">{c.label}</span>
                </label>
              ))}
            </fieldset>
          </li>
        ))}
      </ul>
      {!readOnly && (
        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t bg-card/95 px-4 py-3 backdrop-blur sm:px-5">
          <p className="text-sm text-muted-foreground">
            {count("ABSENT")} absent{count("ABSENT") > 1 ? "s" : ""}, {count("LATE")} retard{count("LATE") > 1 ? "s" : ""}
          </p>
          <SubmitButton size="default" pendingLabel="Enregistrement…">
            {roster.taken ? "Mettre à jour l’appel" : "Enregistrer l’appel"}
          </SubmitButton>
        </div>
      )}
    </form>
  );
}
