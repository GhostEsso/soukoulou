"use client";

import { Plus } from "lucide-react";
import { Field, SelectField } from "@/components/form";
import { Button } from "@/components/ui/button";
import { createAssessment } from "../actions";
import { EditDialog } from "../dialogs";

export function AddAssessment({
  schoolId,
  classroomId,
  subjects,
  today,
  teacher = false,
}: {
  teacher?: boolean;
  schoolId: string;
  classroomId: string;
  subjects: [string, string][];
  today: string;
}) {
  return (
    <EditDialog
      title="Nouvelle évaluation"
      description={
        teacher
          ? "La période est déduite de la date."
          : "La période est déduite de la date ; l’enseignant est celui de la matière dans la classe."
      }
      action={createAssessment.bind(null, schoolId, teacher)}
      submitLabel="Créer"
      trigger={
        <Button className="h-10">
          <Plus aria-hidden /> Évaluation
        </Button>
      }
    >
      {(v) => (
        <div className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="classroomId" value={classroomId} />
          <SelectField label="Matière" name="subjectId" required options={subjects} defaultValue={v.subjectId} />
          <Field label="Intitulé" name="title" required maxLength={80} placeholder="Devoir 1" defaultValue={v.title ?? ""} />
          <Field label="Date" name="day" type="date" required defaultValue={v.day ?? today} />
          <Field label="Noté sur" name="maxScore" type="number" min={1} max={100} required defaultValue={v.maxScore ?? "20"} />
        </div>
      )}
    </EditDialog>
  );
}
