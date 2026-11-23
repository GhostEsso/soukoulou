import { ArrowLeft, BookOpen, Clock, GraduationCap, Mail, MapPin, Pencil, Phone, Plus, School } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { getOnboarding, getStructure, getStudentStats } from "@/lib/data";
import { todayISO } from "@/lib/format";
import { schoolNotices } from "@/lib/notices";
import type { Assignment, Performance, Slot, TeacherDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Announcements, Panel } from "../../../dashboard";
import { readOnlyOf } from "../../list";
import { DeleteTeacher, EditTeacher } from "../teacher-actions";
import { PersonAvatar } from "@/components/person-avatar";
import { AccessPanel } from "../../access-panel";
import { PhotoEditor } from "../../photo-editor";
import { AssignDialog } from "./assign";
import { ScheduleView } from "../../schedule-view";
import { AddSlot } from "./slot-dialog";

export const metadata: Metadata = { title: "Fiche enseignant" };

/** Fiche enseignant : profil, chiffres, emploi du temps, cours par classe, raccourcis, performance, annonces. */
export default async function TeacherPage({ params }: PageProps<"/ecole/[schoolId]/enseignants/[teacherId]">) {
  const { schoolId, teacherId } = await params;
  const path = `/schools/${encodeURIComponent(schoolId)}/teachers`;
  const teacher = await api<TeacherDetail>(`${path}/${encodeURIComponent(teacherId)}`).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const school = `/schools/${encodeURIComponent(schoolId)}`;
  const [structure, assignments, slots, perf, stats, onboarding, readOnly] = await Promise.all([
    getStructure(schoolId),
    api<Assignment[]>(`${path}/assignments`),
    api<Slot[]>(`${school}/schedule?teacherId=${encodeURIComponent(teacherId)}`),
    api<Performance>(`${school}/assessments/performance?teacherId=${encodeURIComponent(teacherId)}`),
    getStudentStats(schoolId),
    getOnboarding(schoolId),
    readOnlyOf(schoolId),
  ]);
  const year = structure.years.find((y) => y.isCurrent) ?? structure.years[0];
  const classes = structure.classrooms.filter((c) => c.yearId === year?.id);
  // Cours regroupés par classe (l'API les renvoie déjà triés). Pas de Map.groupBy : absent avant Node 21.
  const byClass = new Map<string, TeacherDetail["teachings"]>();
  for (const t of teacher.teachings) byClass.set(t.classroom.id, [...(byClass.get(t.classroom.id) ?? []), t]);
  const students = stats.byClassroom
    .filter((c) => byClass.has(c.classroomId))
    .reduce((n, c) => n + c.male + c.female, 0);
  const name = `${teacher.firstName} ${teacher.lastName}`;
  const dialog = { schoolId, teacherId, classes, levels: structure.levels, assignments };
  const base = `/ecole/${schoolId}`;

  const hours = Math.round(slots.reduce((n, s) => n + minutes(s.end) - minutes(s.start), 0) / 6) / 10;
  const tiles = [
    { label: "Élèves", value: students, icon: GraduationCap },
    { label: teacher.classes.length > 1 ? "Classes" : "Classe", value: teacher.classes.length, icon: School },
    { label: teacher.subjects.length > 1 ? "Matières" : "Matière", value: teacher.subjects.length, icon: BookOpen },
    { label: "Heures / semaine", value: hours, icon: Clock },
  ];

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`${base}/enseignants`}>
          <ArrowLeft aria-hidden /> Enseignants
        </Link>
      </Button>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="min-w-0 space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="flex flex-col gap-5 rounded-2xl bg-sky-100 p-5 sm:flex-row sm:items-center dark:bg-sky-500/15">
              <div className="relative shrink-0 self-start">
                <PersonAvatar
                  kind="enseignants"
                  schoolId={schoolId}
                  person={teacher}
                  className="size-24 bg-white/70 text-3xl text-sky-800 dark:bg-white/10 dark:text-sky-200"
                />
                {!readOnly && <PhotoEditor schoolId={schoolId} kind="teachers" id={teacher.id} hasPhoto={Boolean(teacher.photo)} />}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h1 className="text-xl font-semibold tracking-tight">{name}</h1>
                    <p className="text-sm text-muted-foreground">
                      {teacher.matricule ?? "Sans matricule"}
                      {teacher.sex && ` · ${teacher.sex === "FEMALE" ? "Enseignante" : "Enseignant"}`}
                    </p>
                  </div>
                  {!readOnly && (
                    <div className="flex shrink-0">
                      <EditTeacher schoolId={schoolId} teacher={teacher} />
                      <DeleteTeacher schoolId={schoolId} teacher={teacher} redirectTo={`${base}/enseignants`} />
                    </div>
                  )}
                </div>
                <ul className="space-y-1.5 text-sm">
                  {(
                    [
                      [Mail, teacher.email, teacher.email && `mailto:${teacher.email}`],
                      [Phone, teacher.phone, teacher.phone && `tel:${teacher.phone.replace(/\s/g, "")}`],
                      [MapPin, teacher.address, null],
                    ] as const
                  ).map(([Icon, value, href], i) => (
                    <li key={i} className="flex min-w-0 items-center gap-2">
                      <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                      {!value ? (
                        <span className="text-muted-foreground">Non renseigné</span>
                      ) : href ? (
                        <a href={href} className="truncate hover:underline">
                          {value}
                        </a>
                      ) : (
                        <span className="truncate">{value}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <ul className="grid grid-cols-2 gap-4">
              {tiles.map((t) => (
                <li key={t.label} className="flex flex-col items-start gap-2 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <t.icon aria-hidden className="size-5" />
                  </span>
                  <span>
                    <span className="block text-2xl font-semibold tabular-nums">{t.value}</span>
                    <span className="text-sm text-muted-foreground">{t.label}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <section className="rounded-2xl border bg-card p-5" aria-label="Emploi du temps">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Emploi du temps</h2>
                <p className="text-sm text-muted-foreground">
                  Semaine type{!readOnly && slots.length > 0 && " · cliquez sur un créneau pour le retirer"}
                </p>
              </div>
              {!readOnly && teacher.teachings.length > 0 && <AddSlot schoolId={schoolId} teachings={teacher.teachings} />}
            </div>
            {slots.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                {teacher.teachings.length === 0
                  ? "Confiez-lui d’abord des cours, puis placez-les dans la semaine."
                  : "Aucun créneau : ajoutez ses heures de cours avec le bouton « Créneau »."}
              </p>
            ) : (
              <ScheduleView schoolId={schoolId} slots={slots} readOnly={readOnly} today={todayISO()} />
            )}
          </section>

          <section className="rounded-2xl border bg-card p-5" aria-label="Classes et matières">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Classes et matières</h2>
                <p className="text-sm text-muted-foreground">{year?.label ?? "Année en cours"}</p>
              </div>
              {!readOnly && classes.length > 0 && (
                <AssignDialog
                  {...dialog}
                  trigger={
                    <Button>
                      <Plus aria-hidden /> Confier des cours
                    </Button>
                  }
                />
              )}
            </div>
            {byClass.size === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                {classes.length === 0
                  ? "Créez d’abord des classes pour l’année en cours."
                  : "Aucun cours confié : choisissez une classe et cochez les matières enseignées."}
              </p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {[...byClass.values()].map((rows) => (
                  <li key={rows[0].classroom.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-20 shrink-0 font-medium">{rows[0].classroom.name}</span>
                    <span className="flex min-w-0 flex-1 flex-wrap gap-1">
                      {rows.map((r) => (
                        <span key={r.id} className="rounded-md bg-muted px-2 py-0.5 text-xs">
                          {r.subject.name}
                        </span>
                      ))}
                    </span>
                    {!readOnly && (
                      <AssignDialog
                        {...dialog}
                        classroomId={rows[0].classroom.id}
                        trigger={
                          <Button size="icon" variant="ghost" aria-label={`Modifier les cours en ${rows[0].classroom.name}`}>
                            <Pencil aria-hidden />
                          </Button>
                        }
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-6">
          {teacher.classes.length > 0 && (
            <Panel title="Raccourcis">
              <div className="space-y-4">
                {(
                  [
                    ["Élèves de", "eleves", "bg-sky-50 hover:bg-sky-100 dark:bg-sky-500/10"],
                    ["Appel en", "presences", "bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10"],
                    ["Notes de", "notes", "bg-violet-50 hover:bg-violet-100 dark:bg-violet-500/10"],
                  ] as const
                ).map(([label, page, tone]) => (
                  <div key={page}>
                    <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">{label}</p>
                    <ul className="flex flex-wrap gap-2">
                      {teacher.classes.map((c) => (
                        <li key={c.id}>
                          <Link
                            href={`${base}/${page}?classe=${c.id}`}
                            className={cn("block rounded-md px-3 py-1.5 text-sm transition-colors", tone)}
                          >
                            {c.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Panel>
          )}
          <Panel title="Accès à son espace">
            <AccessPanel
              schoolId={schoolId}
              kind="teachers"
              id={teacher.id}
              name={`${teacher.firstName} ${teacher.lastName}`}
              phone={teacher.phone}
              account={teacher.account}
              readOnly={readOnly}
            />
          </Panel>
          <Panel title="Performance">
            <Gauge perf={perf} />
          </Panel>
          <Announcements notices={schoolNotices(onboarding)} />
        </aside>
      </div>
    </div>
  );
}

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const fr = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

/** Jauge demi-cercle : moyenne sur 20 des notes qu'il a données cette année, puis le détail par période. */
function Gauge({ perf }: { perf: Performance }) {
  if (perf.average === null) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Pas encore de notes : la moyenne de ses élèves apparaîtra après la première évaluation notée.
      </p>
    );
  }
  const arc = "M 10 90 A 80 80 0 0 1 170 90";
  return (
    <div className="space-y-4">
      <figure className="relative mx-auto w-full max-w-60">
        <svg viewBox="0 0 180 100" className="w-full" aria-hidden>
          <path d={arc} pathLength={100} fill="none" strokeWidth={18} className="stroke-muted" />
          <path
            d={arc}
            pathLength={100}
            fill="none"
            strokeWidth={18}
            strokeDasharray={`${(perf.average / 20) * 100} 100`}
            className={perf.average >= 10 ? "stroke-sky-400" : "stroke-amber-400"}
          />
        </svg>
        <figcaption className="absolute inset-x-0 bottom-0 text-center">
          <span className="block text-3xl font-semibold tabular-nums">{fr(perf.average)}</span>
          <span className="text-xs text-muted-foreground">moyenne sur 20</span>
        </figcaption>
      </figure>
      <p className="text-center text-xs text-muted-foreground">
        {perf.grades} notes · {perf.assessments} évaluation{perf.assessments > 1 ? "s" : ""}
      </p>
      <ul className="divide-y rounded-lg border text-sm">
        {perf.periods.map((p) => (
          <li key={p.id} className="flex justify-between px-3 py-2">
            <span>{p.name}</span>
            <span className="font-medium tabular-nums">{p.average === null ? "—" : `${fr(p.average)} / 20`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
