import { ChevronLeft, ChevronRight, GraduationCap, Presentation, School, Users, Wallet } from "lucide-react";
import Link from "next/link";
import type { Notice } from "@/components/header-tools";
import { AUDIENCES, date, dateTime, todayISO } from "@/lib/format";
import type { Announcement, AttendanceDay, Onboarding, Structure, StudentStats } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Accueil d'une école abonnée : chiffres de la structure, calendrier, échéances, annonces.
 * Présences et finances n'existent pas encore : leurs cartes l'indiquent au lieu d'inventer des chiffres.
 */
export function Dashboard({
  onboarding,
  structure,
  notices,
  announcements,
  month,
  students,
  attendance,
  teachers,
}: {
  onboarding: Onboarding;
  structure: Structure;
  students: StudentStats;
  attendance: AttendanceDay[];
  teachers: number;
  notices: Notice[];
  announcements: Announcement[];
  month?: string;
}) {
  const base = `/ecole/${onboarding.school.id}`;
  const year = structure.years.find((y) => y.isCurrent) ?? structure.years[0];
  const classes = structure.classrooms.filter((c) => c.yearId === year?.id);
  const seats = classes.reduce((n, c) => n + (c.capacity ?? 0), 0);
  const events = upcomingEvents(onboarding, structure);

  const kpis = [
    { label: "Élèves", value: students.total, href: `${base}/eleves`, icon: GraduationCap },
    { label: "Classes", value: classes.length, href: `${base}/classes`, icon: School },
    { label: "Enseignants", value: teachers, href: `${base}/enseignants`, icon: Presentation },
    { label: "Places libres", value: Math.max(0, seats - students.total), href: `${base}/classes`, icon: Users },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="min-w-0 space-y-6">
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {kpis.map((k, i) => (
            <li key={k.label}>
              <Link
                href={k.href}
                className={cn(
                  "group flex h-full flex-col gap-3 rounded-2xl p-4 transition-shadow sm:p-5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  i % 2 === 0 ? "bg-primary/12" : "bg-amber-100 dark:bg-amber-500/15",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-background px-2.5 py-0.5 text-xs font-medium text-success">
                    {year?.label ?? "Aucune année"}
                  </span>
                  <k.icon className="size-4 text-foreground/50" aria-hidden />
                </div>
                <span className="text-3xl font-semibold tabular-nums">{k.value}</span>
                <span className="text-sm text-foreground/70">{k.label}</span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <Panel title="Élèves">
            <SexDonut male={students.male} female={students.female} href={`${base}/eleves`} />
          </Panel>

          <Panel title="Présences de la semaine" action={{ href: `${base}/presences`, label: "Faire l’appel" }}>
            <WeekChart days={attendance} />
          </Panel>
        </div>

        <Panel title="Finances">
          <EmptyChart
            icon={Wallet}
            labels={["Oct", "Nov", "Déc", "Jan", "Fév", "Mar", "Avr", "Mai", "Juin"]}
          />
          <Soon>Frais de scolarité encaissés et dépenses, mois par mois, avec le module Finances.</Soon>
        </Panel>
      </div>

      <aside className="space-y-6">
        <Panel>
          <Calendar month={month} base={base} marked={new Set(events.map((e) => e.day))} />
          <h2 className="mt-5 mb-3 text-base font-semibold">Échéances</h2>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune échéance.{" "}
              {!year && (
                <Link href={`${base}/annees`} className="font-medium text-primary hover:underline">
                  Créer l’année scolaire
                </Link>
              )}
            </p>
          ) : (
            <ul className="space-y-2">
              {events.slice(0, 5).map((e) => (
                <li key={`${e.day}-${e.title}`} className="rounded-lg border-l-4 border-primary/60 bg-muted/50 px-3 py-2">
                  <p className="text-sm font-medium">{e.title}</p>
                  <p className="text-xs text-muted-foreground">{date(e.day)}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Announcements notices={notices} announcements={announcements} href={`${base}/annonces`} />
      </aside>
    </div>
  );
}

/** Anneau garçons / filles (dégradé conique, sans bibliothèque de graphiques). */
function SexDonut({ male, female, href }: { male: number; female: number; href: string }) {
  const total = male + female;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const deg = total ? (male / total) * 360 : 0;
  const rows = [
    { label: "Garçons", n: male, dot: "bg-sky-400", param: "G" },
    { label: "Filles", n: female, dot: "bg-amber-400", param: "F" },
  ];
  return (
    <div className="flex flex-col items-center gap-5 py-2">
      <div
        role="img"
        aria-label={`${male} garçons (${pct(male)} %) et ${female} filles (${pct(female)} %)`}
        className="grid size-44 place-items-center rounded-full"
        style={{
          background: total
            ? `conic-gradient(var(--color-sky-400) 0 ${deg}deg, var(--color-amber-400) ${deg}deg 360deg)`
            : "var(--muted)",
        }}
      >
        <div className="grid size-32 place-items-center rounded-full bg-card text-center">
          <div>
            <p className="text-2xl font-semibold tabular-nums">{total}</p>
            <p className="text-xs text-muted-foreground">élèves</p>
          </div>
        </div>
      </div>
      <ul className="grid w-full grid-cols-2 gap-2 text-center">
        {rows.map((r) => (
          <li key={r.label}>
            <Link href={`${href}?sexe=${r.param}`} className="block rounded-lg p-2 hover:bg-muted">
              <span className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <span aria-hidden className={cn("size-2.5 rounded-full", r.dot)} />
                {r.label}
              </span>
              <span className="block text-xl font-semibold tabular-nums">{r.n}</span>
              <span className="block text-xs text-muted-foreground">{pct(r.n)} %</span>
            </Link>
          </li>
        ))}
      </ul>
      {total === 0 && <p className="text-center text-xs text-muted-foreground">Aucun élève inscrit pour l’instant.</p>}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
}: {
  title?: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-5" aria-label={title}>
      {title && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{title}</h2>
          {action && (
            <Link href={action.href} className="text-sm font-medium text-primary hover:underline">
              {action.label}
            </Link>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven"];
const SERIES = [
  { key: "present", label: "Présents", color: "bg-sky-400" },
  { key: "late", label: "Retards", color: "bg-amber-400" },
  { key: "absent", label: "Absents", color: "bg-rose-400" },
] as const;

/** Barres empilées par jour (présents, retards, absents), à l'échelle du jour le plus chargé. */
function WeekChart({ days }: { days: AttendanceDay[] }) {
  const today = todayISO();
  const max = Math.max(1, ...days.map((d) => d.present + d.late + d.absent));
  const taken = days.filter((d) => d.present + d.late + d.absent > 0);
  const rate = (d: AttendanceDay) => Math.round(((d.present + d.late) / Math.max(1, d.present + d.late + d.absent)) * 100);
  const avg = taken.length ? Math.round(taken.reduce((n, d) => n + rate(d), 0) / taken.length) : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span aria-hidden className={cn("size-2.5 rounded-full", s.color)} /> {s.label}
          </span>
        ))}
        {avg !== null && (
          <span className="ml-auto text-sm text-foreground">
            Présence moyenne <span className="font-semibold">{avg} %</span>
          </span>
        )}
      </div>
      <table className="w-full table-fixed">
        <caption className="sr-only">Présences par jour de la semaine</caption>
        <tbody>
          <tr className="h-44 align-bottom">
            {days.map((d, i) => {
              const total = d.present + d.late + d.absent;
              return (
                <td key={d.day} className="px-2 sm:px-4">
                  <div className="flex h-44 flex-col justify-end">
                    {total === 0 ? (
                      <div className="h-1 rounded-full bg-muted" />
                    ) : (
                      <div
                        className="mx-auto flex w-full max-w-14 flex-col-reverse overflow-hidden rounded-t-lg"
                        style={{ height: `${(total / max) * 100}%` }}
                      >
                        {SERIES.map((s) => (
                          <div key={s.key} className={s.color} style={{ height: `${(d[s.key] / total) * 100}%` }} />
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="sr-only">
                    {WEEKDAYS[i]} : {d.present} présents, {d.late} retards, {d.absent} absents
                  </p>
                </td>
              );
            })}
          </tr>
          <tr aria-hidden>
            {days.map((d, i) => {
              const total = d.present + d.late + d.absent;
              return (
                <td key={d.day} className="pt-2 text-center">
                  <p className={cn("text-xs", d.day === today ? "font-semibold text-foreground" : "text-muted-foreground")}>
                    {WEEKDAYS[i]}
                  </p>
                  <p className="text-xs font-medium tabular-nums">{total ? `${rate(d)} %` : "—"}</p>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Soon({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-center text-xs text-muted-foreground">
      <span className="font-medium text-foreground">Bientôt · </span>
      {children}
    </p>
  );
}

/** Cadre de graphique vide : axes et libellés, sans données. */
function EmptyChart({ icon: Icon, labels }: { icon: React.ElementType; labels: string[] }) {
  return (
    <div aria-hidden className="relative">
      <div className="flex h-44 flex-col justify-between">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="border-t border-dashed" />
        ))}
      </div>
      <div className="mt-2 flex justify-between px-2 text-xs text-muted-foreground">
        {labels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <Icon className="absolute top-16 left-1/2 size-8 -translate-x-1/2 text-muted-foreground/40" />
    </div>
  );
}

// ── Calendrier ───────────────────────────────────────────

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Grille du mois, semaines du lundi au dimanche (6 lignes au plus). */
export function monthGrid(y: number, m: number) {
  const first = new Date(Date.UTC(y, m, 1));
  const start = new Date(first);
  start.setUTCDate(1 - ((first.getUTCDay() + 6) % 7));
  const days: { day: string; inMonth: boolean; weekend: boolean }[] = [];
  for (let d = new Date(start); days.length < 42; d.setUTCDate(d.getUTCDate() + 1)) {
    if (days.length % 7 === 0 && days.length > 0 && d.getUTCMonth() !== m) break;
    days.push({ day: iso(d), inMonth: d.getUTCMonth() === m, weekend: d.getUTCDay() % 6 === 0 });
  }
  return days;
}

function Calendar({ month, base, marked }: { month?: string; base: string; marked: Set<string> }) {
  const today = todayISO();
  const m = MONTH.exec(month ?? "") ?? MONTH.exec(today.slice(0, 7))!;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const shift = (by: number) => {
    const d = new Date(Date.UTC(y, mo + by, 1));
    return `${base}?mois=${iso(d).slice(0, 7)}`;
  };
  const title = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, mo, 1)),
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Link href={shift(-1)} scroll={false} aria-label="Mois précédent" className="grid size-8 place-items-center rounded-md hover:bg-muted">
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
        <h2 className="text-base font-semibold capitalize" aria-live="polite">
          {title}
        </h2>
        <Link href={shift(1)} scroll={false} aria-label="Mois suivant" className="grid size-8 place-items-center rounded-md hover:bg-muted">
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      <table className="w-full table-fixed text-center text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
              <th key={d} scope="col" className="pb-2 font-medium">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chunk(monthGrid(y, mo), 7).map((week) => (
            <tr key={week[0].day}>
              {week.map((d) => (
                <td key={d.day} className="p-0.5">
                  <span
                    aria-current={d.day === today ? "date" : undefined}
                    className={cn(
                      "relative mx-auto grid size-9 place-items-center rounded-md tabular-nums",
                      !d.inMonth && "text-muted-foreground/50",
                      d.inMonth && d.weekend && "text-destructive/80",
                      d.day === today && "bg-primary font-semibold text-primary-foreground",
                    )}
                  >
                    {Number(d.day.slice(8))}
                    {marked.has(d.day) && (
                      <span
                        className={cn(
                          "absolute bottom-1 size-1 rounded-full",
                          d.day === today ? "bg-primary-foreground" : "bg-primary",
                        )}
                      />
                    )}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

// ── Échéances ────────────────────────────────────────────

/** Échéances à venir : périodes de l'année en cours, fin d'abonnement, pièces à envoyer. */
function upcomingEvents({ school, requirements }: Onboarding, s: Structure) {
  const out: { day: string; title: string }[] = [];
  const year = s.years.find((y) => y.isCurrent);
  for (const p of year?.periods ?? []) {
    out.push({ day: p.startsOn.slice(0, 10), title: `Début du ${p.name}` });
    out.push({ day: p.endsOn.slice(0, 10), title: `Fin du ${p.name}` });
  }
  if (school.subscriptionEndsAt) out.push({ day: school.subscriptionEndsAt.slice(0, 10), title: "Fin de l’abonnement" });
  for (const r of requirements) {
    if (r.dueDate && !r.document) out.push({ day: r.dueDate.slice(0, 10), title: `Pièce à envoyer : ${r.name}` });
  }
  const today = todayISO();
  return out.filter((e) => e.day >= today).sort((a, b) => a.day.localeCompare(b.day));
}

/** Annonces publiées par l'école, puis alertes du dossier. */
export function Announcements({
  notices,
  announcements = [],
  href,
}: {
  notices: Notice[];
  announcements?: Announcement[];
  href?: string;
}) {
  const tones = ["bg-sky-50 hover:bg-sky-100 dark:bg-sky-500/10", "bg-primary/10 hover:bg-primary/15", "bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10"];
  const published = href ? announcements.slice(0, 3) : [];
  return (
    <Panel title="Annonces" action={href ? { href, label: "Tout voir" } : undefined}>
      {published.length === 0 && notices.length === 0 ? (
        <p className="text-sm text-muted-foreground">Rien à signaler : votre dossier est à jour.</p>
      ) : (
        <ul className="space-y-3">
          {published.map((a, i) => (
            <li key={a.id}>
              <Link href={href!} className={cn("block rounded-xl p-4 transition-colors", tones[i % 3])}>
                <p className="text-sm font-medium">{a.title}</p>
                <p className="mt-1 line-clamp-2 text-xs whitespace-pre-line text-muted-foreground">{a.body}</p>
                <p className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                  {dateTime(a.createdAt)}
                  {a.audiences?.map((x) => (
                    <span key={x} className="rounded-md bg-background/70 px-1.5 py-0.5">
                      {AUDIENCES[x]}
                    </span>
                  ))}
                </p>
              </Link>
            </li>
          ))}
          {notices.slice(0, 4).map((n, i) => (
            <li key={n.id}>
              <Link href={n.href} className={cn("block rounded-xl p-4 transition-colors", tones[(published.length + i) % 3])}>
                <p className="text-sm font-medium">{n.title}</p>
                {n.detail && <p className="mt-1 text-xs text-muted-foreground">{n.detail}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
