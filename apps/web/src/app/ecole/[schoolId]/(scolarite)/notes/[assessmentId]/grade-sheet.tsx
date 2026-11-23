"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { FormMessage, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import type { ActionState } from "@/lib/api";
import type { AssessmentDetail } from "@/lib/types";
import { saveGrades } from "../../actions";

const num = (v: string) => (v.trim() === "" ? null : Number(v.trim().replace(",", ".")));

/** Une case par élève ; case vide = pas de note (absent, non rendu). Moyenne recalculée en direct. */
export function GradeSheet({
  schoolId,
  assessment: a,
  readOnly,
  teacher = false,
}: {
  schoolId: string;
  assessment: AssessmentDetail;
  readOnly: boolean;
  teacher?: boolean;
}) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(a.students.map((s) => [s.id, s.score === null ? "" : String(s.score).replace(".", ",")])),
  );
  const [state, action] = useActionState<ActionState, FormData>(async (prev, form) => {
    const r = await saveGrades(schoolId, a.id, a.maxScore, prev, form, teacher);
    if (r?.ok) toast.success(r.message);
    return r;
  }, undefined);

  const scores = Object.values(values).map(num).filter((n): n is number => n !== null && Number.isFinite(n));
  const avg = scores.length ? (scores.reduce((x, y) => x + y, 0) / scores.length) * (20 / a.maxScore) : null;

  return (
    <form action={action}>
      <div className="flex flex-wrap gap-2 border-t px-4 py-3 text-sm sm:px-5">
        <span className="rounded-full bg-muted px-3 py-1">
          Notés <span className="font-semibold tabular-nums">{scores.length}</span> / {a.students.length}
        </span>
        <span className="rounded-full bg-muted px-3 py-1">
          Moyenne{" "}
          <span className="font-semibold tabular-nums">
            {avg === null ? "—" : avg.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
          </span>{" "}
          / 20
        </span>
      </div>
      {state?.error && (
        <div className="px-4 pb-3 sm:px-5">
          <FormMessage state={state} />
        </div>
      )}
      <ul className="divide-y border-t">
        {a.students.map((s, i) => {
          const n = num(values[s.id]);
          const bad = n !== null && (!Number.isFinite(n) || n < 0 || n > a.maxScore);
          return (
            <li key={s.id} className="flex items-center gap-3 px-4 py-2 sm:px-5">
              <span className="w-6 text-right text-xs text-muted-foreground tabular-nums">{i + 1}</span>
              <label htmlFor={`n_${s.id}`} className="min-w-0 flex-1 truncate text-sm">
                <span className="font-medium">{s.lastName}</span> {s.firstName}
              </label>
              <Input
                id={`n_${s.id}`}
                name={`n_${s.id}`}
                inputMode="decimal"
                autoComplete="off"
                disabled={readOnly}
                value={values[s.id]}
                onChange={(e) => setValues((v) => ({ ...v, [s.id]: e.target.value }))}
                aria-invalid={bad || undefined}
                className="h-9 w-20 text-right tabular-nums"
              />
              <span className="w-8 text-xs text-muted-foreground">/ {a.maxScore}</span>
            </li>
          );
        })}
      </ul>
      {!readOnly && (
        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t bg-card/95 px-4 py-3 backdrop-blur sm:px-5">
          <p className="text-sm text-muted-foreground">Case vide : pas de note.</p>
          <SubmitButton size="default" pendingLabel="Enregistrement…">
            Enregistrer les notes
          </SubmitButton>
        </div>
      )}
    </form>
  );
}
