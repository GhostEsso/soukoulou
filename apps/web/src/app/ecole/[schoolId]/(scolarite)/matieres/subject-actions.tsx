"use client";

import { Pencil, Plus } from "lucide-react";
import { Field } from "@/components/form";
import { Button } from "@/components/ui/button";
import type { Subject } from "@/lib/types";
import { createSubject, updateSubject } from "../actions";
import { DeleteButton, EditDialog } from "../dialogs";

function Fields({ v, s }: { v: Record<string, string>; s?: Subject }) {
  return (
    <div className="grid gap-3">
      <Field label="Nom" name="name" required placeholder="Mathématiques" defaultValue={v.name ?? s?.name} />
      <Field
        label="Abréviation"
        name="shortName"
        maxLength={12}
        placeholder="Maths"
        hint="Facultatif. Affichée sur les bulletins si le nom est long."
        defaultValue={v.shortName ?? s?.shortName ?? ""}
      />
    </div>
  );
}

export function AddSubject({ schoolId }: { schoolId: string }) {
  return (
    <EditDialog
      title="Nouvelle matière"
      description="Elle rejoint la liste commune ; choisissez ensuite les niveaux et coefficients dans Niveaux."
      action={createSubject.bind(null, schoolId)}
      submitLabel="Ajouter"
      trigger={
        <Button className="h-10">
          <Plus aria-hidden /> Ajouter
        </Button>
      }
    >
      {(v) => <Fields v={v} />}
    </EditDialog>
  );
}

export function SubjectRowActions({ schoolId, subject }: { schoolId: string; subject: Subject }) {
  const n = subject._count.levels;
  return (
    <div className="flex justify-end gap-1">
      <EditDialog
        title={`Modifier ${subject.name}`}
        action={updateSubject.bind(null, schoolId, subject.id)}
        trigger={
          <Button size="icon" variant="ghost" aria-label={`Modifier ${subject.name}`}>
            <Pencil aria-hidden />
          </Button>
        }
      >
        {(v) => <Fields v={v} s={subject} />}
      </EditDialog>
      <DeleteButton
        schoolId={schoolId}
        kind="subject"
        id={subject.id}
        label={subject.name}
        warning={
          n > 0
            ? `Elle sera retirée de ${n} niveau${n > 1 ? "x" : ""} et de leurs coefficients.`
            : "Elle n’est utilisée par aucun niveau."
        }
      />
    </div>
  );
}
