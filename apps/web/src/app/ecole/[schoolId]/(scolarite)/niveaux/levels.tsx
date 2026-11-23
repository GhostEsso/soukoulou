"use client";

import { ArrowDown, ArrowUp, Pencil, Plus, SlidersHorizontal } from "lucide-react";
import { Field } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { Level, Subject } from "@/lib/types";
import { createLevel, orderLevels, renameLevel, setLevelSubjects } from "../actions";
import { ActionButton, DeleteButton, EditDialog } from "../dialogs";

export function AddLevel({ schoolId }: { schoolId: string }) {
  return (
    <EditDialog
      title="Nouveau niveau"
      description="Ajouté à la fin de la liste ; réordonnez-le avec les flèches."
      action={createLevel.bind(null, schoolId)}
      submitLabel="Ajouter"
      trigger={
        <Button className="h-10">
          <Plus aria-hidden /> Ajouter
        </Button>
      }
    >
      {(v) => <Field label="Nom du niveau" name="name" required placeholder="6e" defaultValue={v.name} />}
    </EditDialog>
  );
}

/** Flèches d'ordre : l'ordre complet est renvoyé, comme l'exige l'API. */
export function MoveLevel({ schoolId, ids, index, name }: { schoolId: string; ids: string[]; index: number; name: string }) {
  const swap = (by: -1 | 1) => {
    const next = [...ids];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    return orderLevels.bind(null, schoolId, next);
  };
  return (
    <div className="flex gap-0.5">
      <ActionButton action={swap(-1)} variant="ghost" size="icon" disabled={index === 0} aria-label={`Monter ${name}`}>
        <ArrowUp aria-hidden />
      </ActionButton>
      <ActionButton
        action={swap(1)}
        variant="ghost"
        size="icon"
        disabled={index === ids.length - 1}
        aria-label={`Descendre ${name}`}
      >
        <ArrowDown aria-hidden />
      </ActionButton>
    </div>
  );
}

export function LevelRowActions({ schoolId, level, subjects }: { schoolId: string; level: Level; subjects: Subject[] }) {
  const current = new Map(level.subjects.map((s) => [s.subjectId, s.coefficient]));
  return (
    <div className="flex justify-end gap-1">
      <EditDialog
        title={`Matières de ${level.name}`}
        description={
          subjects.length
            ? "Cochez les matières enseignées et indiquez leur coefficient pour le calcul des moyennes."
            : "Ajoutez d’abord des matières dans la page Matières."
        }
        action={setLevelSubjects.bind(null, schoolId, level.id)}
        trigger={
          <Button size="sm" variant="outline">
            <SlidersHorizontal aria-hidden /> Coefficients
          </Button>
        }
      >
        {(v) => {
          const fromError = Object.keys(v).length > 0;
          return (
            <ul className="max-h-[55vh] divide-y overflow-y-auto rounded-lg border">
              {subjects.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-3 py-2">
                  <Checkbox
                    id={`use_${s.id}`}
                    name={`use_${s.id}`}
                    defaultChecked={fromError ? `use_${s.id}` in v : current.has(s.id)}
                  />
                  <label htmlFor={`use_${s.id}`} className="min-w-0 flex-1 truncate text-sm">
                    {s.name}
                  </label>
                  <Input
                    name={`coef_${s.id}`}
                    inputMode="decimal"
                    aria-label={`Coefficient ${s.name}`}
                    className="h-9 w-20 text-right"
                    defaultValue={v[`coef_${s.id}`] ?? String(current.get(s.id) ?? 1)}
                  />
                </li>
              ))}
            </ul>
          );
        }}
      </EditDialog>
      <EditDialog
        title={`Renommer ${level.name}`}
        action={renameLevel.bind(null, schoolId, level.id)}
        trigger={
          <Button size="icon" variant="ghost" aria-label={`Renommer ${level.name}`}>
            <Pencil aria-hidden />
          </Button>
        }
      >
        {(v) => <Field label="Nom du niveau" name="name" required defaultValue={v.name ?? level.name} />}
      </EditDialog>
      <DeleteButton
        schoolId={schoolId}
        kind="level"
        id={level.id}
        label={level.name}
        warning="Ses coefficients seront supprimés. Impossible tant que le niveau a des classes."
      />
    </div>
  );
}
