"use client";

import { CalendarRange, Pencil, Plus } from "lucide-react";
import { Field, SelectField } from "@/components/form";
import { EmptyState } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { date } from "@/lib/format";
import type { AcademicYear } from "@/lib/types";
import { createYear, setCurrentYear, updateYear } from "../actions";
import { ActionButton, DeleteButton, EditDialog } from "../dialogs";

const day = (iso: string) => iso.slice(0, 10);
const TYPE = { TRIMESTER: "Trimestres", SEMESTER: "Semestres" } as const;

export function YearsList({ schoolId, years, readOnly }: { schoolId: string; years: AcademicYear[]; readOnly: boolean }) {
  if (years.length === 0) {
    return (
      <EmptyState
        icon={<CalendarRange className="size-5" aria-hidden />}
        title="Aucune année scolaire"
        description="Créez votre année avec le bouton « Ajouter » : ses périodes (trimestres ou semestres) servent aux notes et aux bulletins."
      />
    );
  }
  return (
    <div className="space-y-4">
      {years.map((y) => (
        <YearCard key={y.id} schoolId={schoolId} year={y} readOnly={readOnly} />
      ))}
    </div>
  );
}

function YearCard({ schoolId, year, readOnly }: { schoolId: string; year: AcademicYear; readOnly: boolean }) {
  return (
    <section className="rounded-xl border bg-card" aria-labelledby={`year-${year.id}`}>
      <header className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 id={`year-${year.id}`} className="flex items-center gap-2 text-lg font-semibold">
            {year.label}
            {year.isCurrent && <StatusBadge tone="success">En cours</StatusBadge>}
          </h2>
          <p className="text-sm text-muted-foreground">
            Du {date(year.startsOn)} au {date(year.endsOn)} · {TYPE[year.periodType]} ·{" "}
            {year._count.classrooms} classe{year._count.classrooms > 1 ? "s" : ""}
          </p>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-1">
            {!year.isCurrent && (
              <ActionButton action={setCurrentYear.bind(null, schoolId, year.id)} pendingLabel="…">
                Définir en cours
              </ActionButton>
            )}
            <EditYear schoolId={schoolId} year={year} />
            <DeleteButton
              schoolId={schoolId}
              kind="year"
              id={year.id}
              label={year.label}
              warning="L’année et ses périodes seront supprimées. Impossible tant qu’elle contient des classes."
            />
          </div>
        )}
      </header>
      <ol className="grid gap-px overflow-hidden rounded-b-xl bg-border sm:grid-cols-3">
        {year.periods.map((p) => (
          <li key={p.id} className="bg-card px-5 py-3">
            <p className="text-sm font-medium">{p.name}</p>
            <p className="text-xs text-muted-foreground">
              {date(p.startsOn)} → {date(p.endsOn)}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function EditYear({ schoolId, year }: { schoolId: string; year: AcademicYear }) {
  return (
    <EditDialog
      title={`Modifier ${year.label}`}
      description="Les périodes doivent se suivre sans se chevaucher, entre la rentrée et la fin de l’année."
      action={updateYear.bind(null, schoolId, year.id, year.periods.length)}
      trigger={
        <Button size="icon" variant="ghost" aria-label={`Modifier ${year.label}`}>
          <Pencil aria-hidden />
        </Button>
      }
    >
      {(v) => (
        <div className="space-y-4">
          <Field label="Année" name="label" required pattern="\d{4}-\d{4}" defaultValue={v.label ?? year.label} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rentrée" name="startsOn" type="date" required defaultValue={v.startsOn ?? day(year.startsOn)} />
            <Field label="Fin de l’année" name="endsOn" type="date" required defaultValue={v.endsOn ?? day(year.endsOn)} />
          </div>
          {year.periods.map((p, i) => (
            <fieldset key={p.id} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
              <legend className="sr-only">{p.name}</legend>
              <Field label="Nom" name={`p${i}_name`} required defaultValue={v[`p${i}_name`] ?? p.name} />
              <Field label="Début" name={`p${i}_start`} type="date" required defaultValue={v[`p${i}_start`] ?? day(p.startsOn)} />
              <Field label="Fin" name={`p${i}_end`} type="date" required defaultValue={v[`p${i}_end`] ?? day(p.endsOn)} />
            </fieldset>
          ))}
        </div>
      )}
    </EditDialog>
  );
}

export function AddYear({ schoolId, first }: { schoolId: string; first: boolean }) {
  return (
    <EditDialog
      title="Nouvelle année scolaire"
      description={
        first
          ? "Elle devient votre année en cours. Les périodes sont découpées automatiquement ; ajustez-les ensuite."
          : "Préparez la rentrée suivante ; l’année en cours ne change pas."
      }
      action={createYear.bind(null, schoolId)}
      submitLabel="Créer l’année"
      trigger={
        <Button className="h-10">
          <Plus aria-hidden /> Ajouter
        </Button>
      }
    >
      {(v) => (
        <div className="grid gap-3">
          <Field label="Année" name="label" required pattern="\d{4}-\d{4}" placeholder="2026-2027" defaultValue={v.label} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rentrée" name="startsOn" type="date" required defaultValue={v.startsOn} />
            <Field label="Fin de l’année" name="endsOn" type="date" required defaultValue={v.endsOn} />
          </div>
          <SelectField
            label="Découpage"
            name="periodType"
            required
            defaultValue={v.periodType ?? "TRIMESTER"}
            options={[
              ["TRIMESTER", "3 trimestres"],
              ["SEMESTER", "2 semestres"],
            ]}
          />
        </div>
      )}
    </EditDialog>
  );
}
