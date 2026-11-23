import { CalendarCheck } from "lucide-react";
import type { Metadata } from "next";
import { DayInput, FilterSelect } from "@/app/ecole/[schoolId]/(scolarite)/filter-select";
import { ListCard, one } from "@/app/ecole/[schoolId]/(scolarite)/list";
import { RollCall } from "@/app/ecole/[schoolId]/(scolarite)/presences/roll-call";
import { EmptyState } from "@/components/page-header";
import { api } from "@/lib/api";
import { getTeacherHome } from "@/lib/data";
import { todayISO } from "@/lib/format";
import type { Roster } from "@/lib/types";

export const metadata: Metadata = { title: "Appel" };

export default async function TeacherRollCallPage({ params, searchParams }: PageProps<"/prof/[schoolId]/appel">) {
  const { schoolId } = await params;
  const sp = await searchParams;
  const home = await getTeacherHome(schoolId);
  const classes = [...new Map(home.teachings.map((t) => [t.classroom.id, t.classroom])).values()];
  const today = todayISO();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(one(sp.jour)) && one(sp.jour) <= today ? one(sp.jour) : today;
  const classroom = classes.find((c) => c.id === one(sp.classe)) ?? classes[0];

  if (!classroom) {
    return (
      <EmptyState
        icon={<CalendarCheck className="size-5" aria-hidden />}
        title="Aucune classe"
        description="L’école ne vous a pas encore confié de cours."
      />
    );
  }

  const roster = await api<Roster>(
    `/schools/${encodeURIComponent(schoolId)}/teacher/attendance?classroomId=${encodeURIComponent(classroom.id)}&day=${day}`,
  );

  return (
    <ListCard
      title={`Appel · ${classroom.name}`}
      count={roster.students.length}
      actions={
        <>
          {classes.length > 1 && (
            <FilterSelect param="classe" value={classroom.id} label="Classe" options={classes.map((c) => [c.id, c.name])} />
          )}
          <DayInput param="jour" value={day} max={today} label="Jour de l’appel" />
        </>
      }
    >
      {roster.students.length === 0 ? (
        <p className="border-t px-5 py-12 text-center text-sm text-muted-foreground">
          Aucun élève inscrit dans {classroom.name}.
        </p>
      ) : (
        <RollCall key={`${roster.classroom.id}-${roster.day}`} schoolId={schoolId} roster={roster} readOnly={false} teacher />
      )}
    </ListCard>
  );
}
