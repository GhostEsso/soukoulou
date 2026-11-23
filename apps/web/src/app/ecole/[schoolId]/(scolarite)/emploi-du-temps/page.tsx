import { CalendarClock } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/page-header";
import { api } from "@/lib/api";
import { getStructure } from "@/lib/data";
import { todayISO } from "@/lib/format";
import type { Slot } from "@/lib/types";
import { FilterSelect } from "../filter-select";
import { ListCard, one } from "../list";
import { ScheduleView } from "../schedule-view";

export const metadata: Metadata = { title: "Emploi du temps" };

/** Semaine type d'une classe. Lecture seule : les créneaux se gèrent depuis la fiche de chaque enseignant. */
export default async function SchedulePage({ params, searchParams }: PageProps<"/ecole/[schoolId]/emploi-du-temps">) {
  const { schoolId } = await params;
  const sp = await searchParams;
  const structure = await getStructure(schoolId);
  const year = structure.years.find((y) => y.isCurrent) ?? structure.years[0];
  const classes = structure.classrooms.filter((c) => c.yearId === year?.id);
  const classroom = classes.find((c) => c.id === one(sp.classe)) ?? classes[0];

  if (!classroom) {
    return (
      <EmptyState
        icon={<CalendarClock className="size-5" aria-hidden />}
        title="Aucune classe"
        description="Créez l’année scolaire et ses classes, puis placez les cours depuis la fiche de chaque enseignant."
      />
    );
  }

  const slots = await api<Slot[]>(
    `/schools/${encodeURIComponent(schoolId)}/schedule?classroomId=${encodeURIComponent(classroom.id)}`,
  );

  return (
    <ListCard
      title={`Emploi du temps · ${classroom.name}`}
      count={slots.length}
      actions={<FilterSelect param="classe" value={classroom.id} label="Classe" options={classes.map((c) => [c.id, c.name])} />}
    >
      <div className="border-t p-4 sm:p-5">
        {slots.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Aucun créneau pour {classroom.name} : placez les cours depuis la fiche de chaque enseignant.
          </p>
        ) : (
          <ScheduleView key={classroom.id} schoolId={schoolId} slots={slots} readOnly today={todayISO()} by="classroom" />
        )}
      </div>
    </ListCard>
  );
}
