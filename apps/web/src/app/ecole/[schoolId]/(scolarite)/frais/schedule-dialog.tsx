"use client";

import { Pencil, Plus, RotateCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Field, SelectField } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { FeeSchedule } from "@/lib/types";
import { EditDialog } from "../dialogs";
import { createSchedule, deleteSchedule, reapplySchedule, updateSchedule } from "./actions";

type Level = { id: string; name: string };
type Row = { amount: string; dueOn: string };

const AUDIENCES: [string, string][] = [
  ["ALL", "Tous les élèves"],
  ["FEMALE", "Filles"],
  ["MALE", "Garçons"],
];

/** Tranches : montant + échéance ; « Ajouter une tranche » seulement si l'offre le permet. */
function Lines({ initial, multi }: { initial: Row[]; multi: boolean }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const set = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">Tranches</legend>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <Field label={rows.length > 1 ? `Montant ${i + 1} (FCFA)` : "Montant (FCFA)"} name={`amount_${i}`} inputMode="numeric" required placeholder="25 000" value={r.amount} onChange={(e) => set(i, { amount: e.target.value })} />
          <Field label="Échéance" name={`due_${i}`} type="date" required value={r.dueOn} onChange={(e) => set(i, { dueOn: e.target.value })} />
          {rows.length > 1 ? (
            <Button type="button" size="icon" variant="ghost" aria-label={`Retirer la tranche ${i + 1}`} onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>
              <Trash2 aria-hidden />
            </Button>
          ) : (
            <span className="size-9" />
          )}
        </div>
      ))}
      {multi && (
        <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => setRows((x) => [...x, { amount: "", dueOn: "" }])}>
          <Plus aria-hidden /> Ajouter une tranche
        </Button>
      )}
    </fieldset>
  );
}

function Form({ levels, schedule, multi, v }: { levels: Level[]; schedule?: FeeSchedule; multi: boolean; v: Record<string, string> }) {
  const fromError = Object.keys(v).length > 0;
  const chosen = new Set(schedule?.levels.map((l) => l.id));
  const initial: Row[] = fromError
    ? Array.from({ length: Math.max(1, Object.keys(v).filter((k) => k.startsWith("amount_")).length) }, (_, i) => ({ amount: v[`amount_${i}`] ?? "", dueOn: v[`due_${i}`] ?? "" }))
    : schedule
      ? schedule.lines.map((l) => ({ amount: String(l.amount), dueOn: l.dueOn }))
      : [{ amount: "", dueOn: "" }];
  return (
    <div className="space-y-4">
      <Field label="Libellé (facultatif)" name="label" placeholder="Scolarité 6e–3e" defaultValue={v.label ?? schedule?.label ?? ""} />
      <SelectField label="Public" name="sex" options={AUDIENCES} defaultValue={v.sex ?? schedule?.sex ?? "ALL"} required />
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Niveaux</legend>
        <ul className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto rounded-lg border p-2">
          {levels.map((l) => (
            <li key={l.id} className="flex items-center gap-2">
              <Checkbox id={`level_${l.id}`} name={`level_${l.id}`} defaultChecked={fromError ? `level_${l.id}` in v : chosen.has(l.id)} />
              <label htmlFor={`level_${l.id}`} className="text-sm">
                {l.name}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <Lines initial={initial} multi={multi} />
    </div>
  );
}

export function AddSchedule({ schoolId, yearId, levels, multi }: { schoolId: string; yearId: string; levels: Level[]; multi: boolean }) {
  return (
    <EditDialog
      title="Nouvelle règle de frais"
      description="Le dû est figé à l’inscription de l’élève : modifier une règle ne change pas les élèves déjà inscrits."
      action={createSchedule.bind(null, schoolId, yearId)}
      submitLabel="Ajouter"
      trigger={
        <Button className="h-10">
          <Plus aria-hidden /> Ajouter une règle
        </Button>
      }
    >
      {(v) => <Form levels={levels} multi={multi} v={v} />}
    </EditDialog>
  );
}

export function ScheduleActions({ schoolId, yearId, schedule, levels, multi }: { schoolId: string; yearId: string; schedule: FeeSchedule; levels: Level[]; multi: boolean }) {
  return (
    <div className="flex justify-end gap-1">
      <EditDialog
        title="Modifier la règle"
        description="Les élèves ayant déjà un dû le gardent. Pour l’appliquer à ceux qui n’ont encore rien payé, utilisez « Recalculer »."
        action={updateSchedule.bind(null, schoolId, yearId, schedule.id)}
        trigger={
          <Button size="icon" variant="ghost" aria-label="Modifier la règle">
            <Pencil aria-hidden />
          </Button>
        }
      >
        {(v) => <Form levels={levels} schedule={schedule} multi={multi} v={v} />}
      </EditDialog>
      <EditDialog
        title="Recalculer les élèves sans paiement ?"
        description="Le dû des élèves de cette règle qui n’ont aucun paiement est recalculé avec les montants actuels. Ceux qui ont payé gardent leur montant."
        action={reapplySchedule.bind(null, schoolId, schedule.id)}
        submitLabel="Recalculer"
        trigger={
          <Button size="icon" variant="ghost" aria-label="Recalculer les élèves sans paiement">
            <RotateCw aria-hidden />
          </Button>
        }
      >
        {() => null}
      </EditDialog>
      <EditDialog
        title="Supprimer cette règle ?"
        description="Les élèves déjà inscrits gardent leur dû. Seuls les prochains inscrits ne seront plus concernés."
        action={deleteSchedule.bind(null, schoolId, schedule.id)}
        submitLabel="Supprimer"
        trigger={
          <Button size="icon" variant="ghost" aria-label="Supprimer la règle">
            <Trash2 aria-hidden />
          </Button>
        }
      >
        {() => null}
      </EditDialog>
    </div>
  );
}
