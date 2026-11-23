import { ArrowLeft, CalendarCheck, Cake, Hash, Plus, School, Trophy, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { getOnboarding, getStructure } from "@/lib/data";
import { date, RELATIONS, todayISO } from "@/lib/format";
import { schoolNotices } from "@/lib/notices";
import type { DisciplineRecord, ReportPeriod, Slot, StudentAttendance, StudentDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Announcements, Panel } from "../../../dashboard";
import { one, readOnlyOf } from "../../list";
import { ScheduleView } from "../../schedule-view";
import { AddParent } from "../../parents/parent-actions";
import { StudentRowActions } from "../student-actions";
import { AttendanceSummary, GradesSection, ordinal } from "./sections";
import { PersonAvatar } from "@/components/person-avatar";
import { AccessPanel } from "../../access-panel";
import { PhotoEditor } from "../../photo-editor";
import { DeleteButton } from "../../dialogs";
import { DisciplineList } from "@/components/discipline-list";
import { AddDiscipline } from "./discipline-actions";

export const metadata: Metadata = { title: "Fiche élève" };

const fr = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

/** Fiche élève : profil, assiduité, emploi du temps de sa classe, notes par période, absences récentes. */
export default async function StudentPage({ params, searchParams }: PageProps<"/ecole/[schoolId]/eleves/[studentId]">) {
  const { schoolId, studentId } = await params;
  const sp = await searchParams;
  const school = `/schools/${encodeURIComponent(schoolId)}`;
  const sid = encodeURIComponent(studentId);
  const student = await api<StudentDetail>(`${school}/students/${sid}`).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const [structure, attendance, report, slots, onboarding, readOnly, discipline] = await Promise.all([
    getStructure(schoolId),
    api<StudentAttendance>(`${school}/attendance/student/${sid}`),
    api<{ periods: ReportPeriod[] }>(`${school}/assessments/student/${sid}`),
    student.classroom
      ? api<Slot[]>(`${school}/schedule?classroomId=${encodeURIComponent(student.classroom.id)}`)
      : Promise.resolve([]),
    getOnboarding(schoolId),
    readOnlyOf(schoolId),
    api<DisciplineRecord[]>(`${school}/discipline?studentId=${sid}`),
  ]);
  const year = structure.years.find((y) => y.isCurrent) ?? structure.years[0];
  const classes = structure.classrooms.filter((c) => c.yearId === year?.id).map((c): [string, string] => [c.id, c.name]);
  // Période affichée : celle demandée, sinon la dernière qui a des notes.
  const period =
    report.periods.find((p) => p.id === one(sp.periode)) ??
    report.periods.findLast((p) => p.average !== null) ??
    report.periods[0];
  const base = `/ecole/${schoolId}`;
  const here = `${base}/eleves/${studentId}`;
  const c = student.classroom;

  const tiles = [
    { label: "Présence", value: attendance.rate === null ? "—" : `${fr(attendance.rate)} %`, icon: CalendarCheck },
    { label: c ? `Classe · niveau ${c.level.name}` : "Classe", value: c?.name ?? "—", icon: School },
    { label: `Moyenne${period ? ` · ${period.name}` : ""}`, value: period?.average == null ? "—" : fr(period.average), icon: TrendingUp },
    {
      label: "Rang",
      value: period?.rank == null ? "—" : `${ordinal(period.rank, student.sex)} / ${period.ranked}`,
      icon: Trophy,
    },
  ];

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`${base}/eleves${c ? `?classe=${c.id}` : ""}`}>
          <ArrowLeft aria-hidden /> Élèves
        </Link>
      </Button>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="min-w-0 space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <section
              className={cn(
                "flex flex-col gap-5 rounded-2xl p-5 sm:flex-row sm:items-center",
                student.sex === "FEMALE" ? "bg-amber-100 dark:bg-amber-500/15" : "bg-sky-100 dark:bg-sky-500/15",
              )}
            >
              <div className="relative shrink-0 self-start">
                <PersonAvatar kind="eleves" schoolId={schoolId} person={student} className="size-24 bg-white/70 text-3xl dark:bg-white/10" />
                {!readOnly && <PhotoEditor schoolId={schoolId} kind="students" id={student.id} hasPhoto={Boolean(student.photo)} />}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h1 className="text-xl font-semibold tracking-tight">
                      {student.firstName} {student.lastName}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      Élève {c ? `de ${c.name}` : "non inscrit cette année"}
                    </p>
                  </div>
                  {!readOnly && (
                    <StudentRowActions
                      schoolId={schoolId}
                      student={{ ...student, classroom: c && { id: c.id, name: c.name } }}
                      classes={classes}
                      redirectTo={`${base}/eleves`}
                    />
                  )}
                </div>
                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-center gap-2">
                    <Hash aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                    {student.matricule ?? <span className="text-muted-foreground">Sans matricule</span>}
                  </li>
                  <li className="flex items-center gap-2">
                    <Cake aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                    {student.birthDate ? (
                      `${student.sex === "FEMALE" ? "Née" : "Né"} le ${date(student.birthDate)}`
                    ) : (
                      <span className="text-muted-foreground">Date de naissance non renseignée</span>
                    )}
                  </li>
                </ul>
              </div>
            </section>

            <ul className="grid grid-cols-2 gap-4">
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
          </div>

          {c && (
            <section className="rounded-2xl border bg-card p-5" aria-label="Emploi du temps">
              <div className="mb-4">
                <h2 className="text-base font-semibold">Emploi du temps · {c.name}</h2>
                <p className="text-sm text-muted-foreground">Semaine type de la classe</p>
              </div>
              {slots.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Aucun créneau pour {c.name} : placez les cours depuis la fiche de chaque enseignant.
                </p>
              ) : (
                // Lecture seule ici : les créneaux se gèrent depuis la fiche enseignant.
                <ScheduleView schoolId={schoolId} slots={slots} readOnly today={todayISO()} by="classroom" />
              )}
            </section>
          )}

          <GradesSection
            periods={report.periods}
            period={period}
            href={(id) => `${here}?periode=${id}`}
            sex={student.sex}
            empty={c ? "Aucune période définie pour l’année en cours." : "L’élève n’est inscrit dans aucune classe cette année."}
          />
        </div>

        <aside className="min-w-0 space-y-6">
          {c && (
            <Panel title="Raccourcis">
              <ul className="flex flex-wrap gap-2">
                {(
                  [
                    [`Élèves de ${c.name}`, `${base}/eleves?classe=${c.id}`, "bg-sky-50 hover:bg-sky-100 dark:bg-sky-500/10"],
                    [`Appel en ${c.name}`, `${base}/presences?classe=${c.id}`, "bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10"],
                    [`Notes de ${c.name}`, `${base}/notes?classe=${c.id}`, "bg-violet-50 hover:bg-violet-100 dark:bg-violet-500/10"],
                  ] as const
                ).map(([label, href, tone]) => (
                  <li key={href}>
                    <Link href={href} className={cn("block rounded-md px-3 py-1.5 text-sm transition-colors", tone)}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title="Accès à son espace">
            <AccessPanel
              schoolId={schoolId}
              kind="students"
              id={student.id}
              name={`${student.firstName} ${student.lastName}`}
              phone={student.matricule}
              account={student.account}
              readOnly={readOnly}
            />
          </Panel>
          <Panel title="Parents">
            {student.parents.length === 0 ? (
              <p className="mb-3 text-sm text-muted-foreground">Aucun parent rattaché.</p>
            ) : (
              <ul className="mb-3 divide-y rounded-lg border text-sm">
                {student.parents.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {p.firstName} {p.lastName}
                      </span>
                      <span className="text-xs text-muted-foreground">{RELATIONS[p.relation]}</span>
                    </span>
                    <a href={`tel:${p.phone.replace(/\s/g, "")}`} className="shrink-0 tabular-nums hover:underline">
                      {p.phone}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              {!readOnly && (
                <AddParent
                  schoolId={schoolId}
                  child={{ id: student.id, name: `${student.lastName} ${student.firstName}`, classroom: c?.name ?? null }}
                  trigger={
                    <Button size="sm" variant="outline">
                      <Plus aria-hidden /> Ajouter un parent
                    </Button>
                  }
                />
              )}
              {student.parents.length > 0 && (
                <Button asChild size="sm" variant="ghost">
                  <Link href={`${base}/parents?q=${encodeURIComponent(student.lastName)}`}>Voir les fiches</Link>
                </Button>
              )}
            </div>
          </Panel>
          <Panel title="Assiduité">
            <AttendanceSummary attendance={attendance} />
          </Panel>
          <Panel title="Discipline">
            <div className="space-y-3">
              <DisciplineList
                items={discipline}
                action={
                  readOnly
                    ? undefined
                    : (r) => (
                        <DeleteButton
                          schoolId={schoolId}
                          kind="discipline"
                          id={r.id}
                          label={r.reason}
                          warning="L’inscription disparaîtra aussi des espaces de l’élève et de ses parents."
                        />
                      )
                }
              />
              {!readOnly && (
                <AddDiscipline schoolId={schoolId} studentId={student.id} name={`${student.firstName} ${student.lastName}`} />
              )}
            </div>
          </Panel>
          <Announcements notices={schoolNotices(onboarding)} />
        </aside>
      </div>
    </div>
  );
}
