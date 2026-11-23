"use client";

import { Pencil, Plus } from "lucide-react";
import { Field, SelectField } from "@/components/form";
import { Button } from "@/components/ui/button";
import type { Classroom } from "@/lib/types";
import { createClassroom, updateClassroom } from "../actions";
import { DeleteButton, EditDialog } from "../dialogs";

type Options = [string, string][];

export function AddClass({
  schoolId,
  years,
  levels,
  defaultYear,
}: {
  schoolId: string;
  years: Options;
  levels: Options;
  defaultYear: string;
}) {
  const ready = years.length > 0 && levels.length > 0;
  return (
    <EditDialog
      title="Nouvelle classe"
      description={
        ready
          ? "Elle reprend les matières et coefficients de son niveau."
          : "Créez d’abord une année scolaire et au moins un niveau."
      }
      action={createClassroom.bind(null, schoolId)}
      submitLabel="Ajouter"
      trigger={
        <Button className="h-10">
          <Plus aria-hidden /> Ajouter
        </Button>
      }
    >
      {(v) =>
        ready && (
          <div className="grid gap-3">
            <SelectField label="Année scolaire" name="yearId" required options={years} defaultValue={v.yearId ?? defaultYear} />
            <SelectField label="Niveau" name="levelId" required options={levels} defaultValue={v.levelId} />
            <Field label="Nom" name="name" required placeholder="6e A" defaultValue={v.name} />
            <Field label="Capacité (élèves)" name="capacity" type="number" min={1} max={500} hint="Facultatif." defaultValue={v.capacity} />
          </div>
        )
      }
    </EditDialog>
  );
}

export function ClassRowActions({ schoolId, classroom: c, levels }: { schoolId: string; classroom: Classroom; levels: Options }) {
  return (
    <div className="flex justify-end gap-1">
      <EditDialog
        title={`Modifier ${c.name}`}
        action={updateClassroom.bind(null, schoolId, c.id)}
        trigger={
          <Button size="icon" variant="ghost" aria-label={`Modifier ${c.name}`}>
            <Pencil aria-hidden />
          </Button>
        }
      >
        {(v) => (
          <div className="grid gap-3">
            <Field label="Nom" name="name" required defaultValue={v.name ?? c.name} />
            <SelectField label="Niveau" name="levelId" required options={levels} defaultValue={v.levelId ?? c.levelId} />
            <Field
              label="Capacité (élèves)"
              name="capacity"
              type="number"
              min={1}
              max={500}
              defaultValue={v.capacity ?? c.capacity ?? ""}
            />
          </div>
        )}
      </EditDialog>
      <DeleteButton
        schoolId={schoolId}
        kind="classroom"
        id={c.id}
        label={c.name}
        warning="La classe sera supprimée de cette année scolaire."
      />
    </div>
  );
}
