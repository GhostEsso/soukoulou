import { CalendarClock } from "lucide-react";
import type { Metadata } from "next";
import { api } from "@/lib/api";
import { todayISO } from "@/lib/format";
import type { MyExam } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Mes examens" };

const fr = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const DAY = 86_400_000;
const longDate = (d: string) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

/** « Aujourd'hui », « Demain », « Dans 5 jours ». */
function countdown(day: string, today: string) {
  const n = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
  return n === 0 ? "Aujourd’hui" : n === 1 ? "Demain" : `Dans ${n} jours`;
}

/** Devoirs et interrogations de sa classe : ceux à venir, puis les derniers passés avec sa note. */
export default async function MyExamsPage({ params }: PageProps<"/eleve/[schoolId]/examens">) {
  const { schoolId } = await params;
  const { upcoming, past } = await api<{ upcoming: MyExam[]; past: MyExam[] }>(
    `/schools/${encodeURIComponent(schoolId)}/student/exams`,
  );
  const today = todayISO();

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-5" aria-label="À venir">
        <h1 className="mb-4 text-xl font-semibold tracking-tight">Mes examens à venir</h1>
        {upcoming.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Aucun devoir ni interrogation annoncé pour l’instant.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {upcoming.map((e) => {
              const soon = Date.parse(e.day) - Date.parse(today) <= 2 * DAY;
              return (
                <li
                  key={e.id}
                  className={cn(
                    "flex gap-3 rounded-xl p-4",
                    soon ? "bg-amber-50 dark:bg-amber-500/10" : "bg-muted/50",
                  )}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <CalendarClock aria-hidden className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium">{e.subject}</span>
                    <span className="block text-sm">
                      {e.title} · sur {e.maxScore}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground first-letter:uppercase">
                      {longDate(e.day)} ·{" "}
                      <span className={cn(soon && "font-medium text-amber-700 dark:text-amber-400")}>{countdown(e.day, today)}</span>
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-5" aria-label="Passés">
        <h2 className="mb-4 text-base font-semibold">Derniers devoirs</h2>
        {past.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun devoir passé cette année.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Matière</th>
                  <th className="px-3 py-2 font-medium">Évaluation</th>
                  <th className="px-3 py-2 text-right font-medium">Ma note</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {past.map((e) => (
                  <tr key={e.id}>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums first-letter:uppercase">{longDate(e.day)}</td>
                    <td className="px-3 py-2 font-medium">{e.subject}</td>
                    <td className="px-3 py-2">{e.title}</td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right tabular-nums",
                        e.score !== null && e.score < e.maxScore / 2 && "text-destructive",
                      )}
                    >
                      {e.score === null ? <span className="text-muted-foreground">pas encore notée</span> : `${fr(e.score)}/${e.maxScore}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
