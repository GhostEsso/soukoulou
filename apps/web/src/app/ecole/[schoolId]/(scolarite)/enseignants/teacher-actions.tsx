"use client";

import { Pencil, Plus } from "lucide-react";
import { Field, SelectField } from "@/components/form";
import { Button } from "@/components/ui/button";
import type { Teacher } from "@/lib/types";
import { createTeacher, updateTeacher } from "../actions";
import { DeleteButton, EditDialog } from "../dialogs";

function Fields({ v, t }: { v: Record<string, string>; t?: Teacher }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nom" name="lastName" required autoComplete="off" defaultValue={v.lastName ?? t?.lastName} />
      <Field label="Prénom(s)" name="firstName" required autoComplete="off" defaultValue={v.firstName ?? t?.firstName} />
      <SelectField
        label="Sexe"
        name="sex"
        options={[
          ["FEMALE", "Femme"],
          ["MALE", "Homme"],
        ]}
        defaultValue={v.sex ?? t?.sex ?? ""}
      />
      <Field label="Matricule" name="matricule" maxLength={30} defaultValue={v.matricule ?? t?.matricule ?? ""} />
      <Field label="Email" name="email" type="email" autoComplete="off" defaultValue={v.email ?? t?.email ?? ""} />
      <Field label="Téléphone" name="phone" type="tel" placeholder="+228 90 00 00 00" defaultValue={v.phone ?? t?.phone ?? ""} />
      <Field label="Adresse" name="address" className="sm:col-span-2" defaultValue={v.address ?? t?.address ?? ""} />
    </div>
  );
}

export function AddTeacher({ schoolId }: { schoolId: string }) {
  return (
    <EditDialog
      title="Nouvel enseignant"
      description="Vous lui confierez ensuite ses matières et ses classes depuis sa fiche."
      action={createTeacher.bind(null, schoolId)}
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

export function EditTeacher({ schoolId, teacher, label }: { schoolId: string; teacher: Teacher; label?: string }) {
  const name = `${teacher.firstName} ${teacher.lastName}`;
  return (
    <EditDialog
      title={`Modifier ${name}`}
      action={updateTeacher.bind(null, schoolId, teacher.id)}
      trigger={
        label ? (
          <Button variant="outline">
            <Pencil aria-hidden /> {label}
          </Button>
        ) : (
          <Button size="icon" variant="ghost" aria-label={`Modifier ${name}`}>
            <Pencil aria-hidden />
          </Button>
        )
      }
    >
      {(v) => <Fields v={v} t={teacher} />}
    </EditDialog>
  );
}

export function DeleteTeacher({ schoolId, teacher, redirectTo }: { schoolId: string; teacher: Teacher; redirectTo?: string }) {
  return (
    <DeleteButton
      schoolId={schoolId}
      kind="teacher"
      id={teacher.id}
      redirectTo={redirectTo}
      label={`${teacher.firstName} ${teacher.lastName}`}
      warning="Sa fiche et ses cours seront supprimés : les matières concernées n’auront plus d’enseignant."
    />
  );
}
