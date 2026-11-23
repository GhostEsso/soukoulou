import { CalendarCheck } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/page-header";
import { api } from "@/lib/api";
import { getStructure } from "@/lib/data";
import { todayISO } from "@/lib/format";
import type { Roster } from "@/lib/types";
import { DayInput, FilterSelect } from "../filter-select";
import { ListCard, one, readOnlyOf } from "../list";
import { RollCall } from "./roll-call";

export const metadata: Metadata = { title: "Présences" };

export default async function AttendancePage({ params, searchParams }: PageProps<"/ecole/[schoolId]/presences">) {
  const { schoolId } = await params;
  const sp = await searchParams;
  const [structure, readOnly] = await Promise.all([getStructure(schoolId), readOnlyOf(schoolId)]);
  const year = structure.years.find((y) => y.isCurrent) ?? structure.years[0];
  const classes = structure.classrooms.filter((c) => c.yearId === year?.id);
  const today = todayISO();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(one(sp.jour)) && one(sp.jour) <= today ? one(sp.jour) : today;
  const classroom = classes.find((c) => c.id === one(sp.classe)) ?? classes[0];

  if (!classroom) {
    return (
      <EmptyState
        icon={<CalendarCheck className="size-5" aria-hidden />}
        title="Aucune classe"
        description="Créez vos classes et inscrivez vos élèves pour faire l’appel."
      />
    );
  }

  const roster = await api<Roster>(
    `/schools/${encodeURIComponent(schoolId)}/attendance?classroomId=${encodeURIComponent(classroom.id)}&day=${day}`,
  );
  const weekend = [0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay());

  return (
    <ListCard
      title={`Appel · ${classroom.name}`}
      count={roster.students.length}
      actions={
        <>
          <FilterSelect
            param="classe"
            value={classroom.id}
            label="Classe"
            options={classes.map((c) => [c.id, c.name])}
          />
          <DayInput param="jour" value={day} max={today} label="Jour de l’appel" />
        </>
      }
    >
      {weekend && (
        <p className="border-t bg-muted/50 px-5 py-2 text-sm text-muted-foreground">
          Ce jour tombe un week-end : vérifiez la date avant d’enregistrer.
        </p>
      )}
      {roster.students.length === 0 ? (
        <p className="border-t px-5 py-12 text-center text-sm text-muted-foreground">
          Aucun élève inscrit dans {classroom.name}.
        </p>
      ) : (
        // La clé remet la feuille à zéro quand on change de classe ou de jour.
        <RollCall key={`${roster.classroom.id}-${roster.day}`} schoolId={schoolId} roster={roster} readOnly={readOnly} />
      )}
    </ListCard>
  );
}
