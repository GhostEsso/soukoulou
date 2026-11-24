import { CalendarCheck, School, Trophy, TrendingUp } from "lucide-react";
import { Panel } from "@/app/ecole/[schoolId]/dashboard";
import { PersonAvatar } from "@/components/person-avatar";
import { DisciplineList } from "@/components/discipline-list";
import { AttendanceSummary, GradesSection, ordinal } from "@/app/ecole/[schoolId]/(scolarite)/eleves/[studentId]/sections";
import { ScheduleView } from "@/app/ecole/[schoolId]/(scolarite)/schedule-view";
import { todayISO } from "@/lib/format";
import type { ChildFollowUp } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FeesPanel } from "./fees-panel";

const fr = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

/** Suivi d'un élève : moyenne, rang, notes par période, assiduité, emploi du temps. Espaces parent et élève. */
export function FollowUp({
  schoolId,
  data: { child, report, attendance, slots, discipline, fees },
  here,
  periodId,
  aside,
  payment,
}: {
  /** Espace parent : paiement des frais ; absent dans l'espace élève. */
  payment?: { studentId: string; dev: boolean };
  /** Bloc en plus dans la colonne de droite (annonces dans l'espace élève). */
  aside?: React.ReactNode;
  schoolId: string;
  data: ChildFollowUp;
  here: string;
  periodId: string;
}) {
  const period =
    report.periods.find((p) => p.id === periodId) ??
    report.periods.findLast((p) => p.average !== null) ??
    report.periods[0];
  const c = child.classroom;

  const tiles = [
    { label: "Présence", value: attendance.rate === null ? "—" : `${fr(attendance.rate)} %`, icon: CalendarCheck },
    { label: "Classe", value: c?.name ?? "—", icon: School },
    { label: `Moyenne${period ? ` · ${period.name}` : ""}`, value: period?.average == null ? "—" : fr(period.average), icon: TrendingUp },
    { label: "Rang", value: period?.rank == null ? "—" : `${ordinal(period.rank, child.sex)} / ${period.ranked}`, icon: Trophy },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <PersonAvatar
          kind="eleves"
          schoolId={schoolId}
          person={child}
          className={cn("size-12 text-base", child.sex === "FEMALE" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800")}
        />
        <h1 className="text-xl font-semibold tracking-tight">
          {child.firstName} {child.lastName}
          {child.matricule && <span className="ml-2 text-sm font-normal text-muted-foreground">{child.matricule}</span>}
        </h1>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {tiles.map((t) => (
              <li key={t.label} className="flex flex-col items-start gap-2 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <t.icon aria-hidden className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xl font-semibold tabular-nums sm:text-2xl">{t.value}</span>
                  <span className="block text-sm leading-snug text-muted-foreground">{t.label}</span>
                </span>
              </li>
            ))}
          </ul>
          <GradesSection
            periods={report.periods}
            period={period}
            href={(id) => `${here}?periode=${id}`}
            sex={child.sex}
            empty={c ? "Aucune période définie pour l’année en cours." : "Non inscrit dans une classe cette année."}
          />
          {c && slots.length > 0 && (
            <section className="rounded-2xl border bg-card p-5" aria-label="Emploi du temps">
              <h2 className="mb-4 text-base font-semibold">Emploi du temps · {c.name}</h2>
              <ScheduleView schoolId={schoolId} slots={slots} readOnly today={todayISO()} by="classroom" />
            </section>
          )}
        </div>
        <aside className="min-w-0 space-y-6">
          {fees && payment && (
            <Panel title="Frais de scolarité">
              <FeesPanel schoolId={schoolId} studentId={payment.studentId} fees={fees} dev={payment.dev} />
            </Panel>
          )}
          <Panel title="Assiduité">
            <AttendanceSummary attendance={attendance} />
          </Panel>
          <Panel title="Discipline">
            <DisciplineList items={discipline} />
          </Panel>
          {aside}
        </aside>
      </div>
    </div>
  );
}
