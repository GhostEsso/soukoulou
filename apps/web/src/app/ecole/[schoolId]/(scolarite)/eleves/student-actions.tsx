"use client";

import { Pencil, Plus } from "lucide-react";
import { Field, SelectField } from "@/components/form";
import { Button } from "@/components/ui/button";
import type { Student } from "@/lib/types";
import { createStudent, updateStudent } from "../actions";
import { DeleteButton, EditDialog } from "../dialogs";

type Options = [string, string][];
const SEX: Options = [
  ["FEMALE", "Fille"],
  ["MALE", "Garçon"],
];

function Fields({ v, s, classes }: { v: Record<string, string>; s?: Student; classes: Options }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nom" name="lastName" required autoComplete="off" defaultValue={v.lastName ?? s?.lastName} />
      <Field label="Prénom(s)" name="firstName" required autoComplete="off" defaultValue={v.firstName ?? s?.firstName} />
      <SelectField label="Sexe" name="sex" required options={SEX} defaultValue={v.sex ?? s?.sex} />
      <Field
        label="Date de naissance"
        name="birthDate"
        type="date"
        defaultValue={v.birthDate ?? s?.birthDate?.slice(0, 10) ?? ""}
      />
      <SelectField label="Classe" name="classroomId" required options={classes} defaultValue={v.classroomId ?? s?.classroom?.id} />
      <Field
        label="Matricule"
        name="matricule"
        maxLength={30}
        hint="Facultatif, unique dans l’école."
        defaultValue={v.matricule ?? s?.matricule ?? ""}
      />
    </div>
  );
}

export function AddStudent({ schoolId, classes }: { schoolId: string; classes: Options }) {
  return (
    <EditDialog
      title="Inscrire un élève"
      description={classes.length ? undefined : "Créez d’abord des classes pour l’année en cours."}
      action={createStudent.bind(null, schoolId)}
      submitLabel="Inscrire"
      trigger={
        <Button className="h-10">
          <Plus aria-hidden /> Inscrire
        </Button>
      }
    >
      {(v) => classes.length > 0 && <Fields v={v} classes={classes} />}
    </EditDialog>
  );
}

export function StudentRowActions({
  schoolId,
  student,
  classes,
  redirectTo,
}: {
  schoolId: string;
  student: Student;
  classes: Options;
  redirectTo?: string;
}) {
  const name = `${student.firstName} ${student.lastName}`;
  return (
    <div className="flex justify-end gap-1">
      <EditDialog
        title={`Modifier ${name}`}
        action={updateStudent.bind(null, schoolId, student.id)}
        trigger={
          <Button size="icon" variant="ghost" aria-label={`Modifier ${name}`}>
            <Pencil aria-hidden />
          </Button>
        }
      >
        {(v) => <Fields v={v} s={student} classes={classes} />}
      </EditDialog>
      <DeleteButton
        schoolId={schoolId}
        kind="student"
        id={student.id}
        label={name}
        redirectTo={redirectTo}
        warning="L’élève, son historique d’inscription, ses présences et ses notes seront supprimés définitivement."
      />
    </div>
  );
}
