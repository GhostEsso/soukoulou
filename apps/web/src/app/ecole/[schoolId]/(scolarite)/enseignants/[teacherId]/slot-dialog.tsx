"use client";

import { Plus } from "lucide-react";
import { Field, SelectField } from "@/components/form";
import { Button } from "@/components/ui/button";
import type { TeacherDetail } from "@/lib/types";
import { createSlot } from "../../actions";
import { EditDialog } from "../../dialogs";

const DAYS: [string, string][] = [
  ["1", "Lundi"],
  ["2", "Mardi"],
  ["3", "Mercredi"],
  ["4", "Jeudi"],
  ["5", "Vendredi"],
  ["6", "Samedi"],
];

/** Ajoute un créneau hebdomadaire à l'un des cours de l'enseignant. */
export function AddSlot({ schoolId, teachings }: { schoolId: string; teachings: TeacherDetail["teachings"] }) {
  return (
    <EditDialog
      title="Ajouter un créneau"
      description="Le cours revient chaque semaine à ce jour et à cette heure."
      action={createSlot.bind(null, schoolId)}
      submitLabel="Ajouter"
      trigger={
        <Button variant="outline">
          <Plus aria-hidden /> Créneau
        </Button>
      }
    >
      {(v) => (
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            label="Cours"
            name="teachingId"
            required
            className="sm:col-span-2"
            options={teachings.map((t) => [t.id, `${t.classroom.name} · ${t.subject.name}`])}
            defaultValue={v.teachingId ?? (teachings.length === 1 ? teachings[0].id : "")}
          />
          <SelectField label="Jour" name="weekday" required options={DAYS} defaultValue={v.weekday ?? "1"} />
          <Field label="Salle" name="room" maxLength={30} placeholder="Facultatif" defaultValue={v.room ?? ""} />
          <Field label="Début" name="start" type="time" min="06:00" max="20:00" step={300} required defaultValue={v.start ?? "08:00"} />
          <Field label="Fin" name="end" type="time" min="06:00" max="20:00" step={300} required defaultValue={v.end ?? "09:00"} />
        </div>
      )}
    </EditDialog>
  );
}
