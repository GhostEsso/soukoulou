import Link from "next/link";
import { date } from "@/lib/format";
import type { ReportPeriod, StudentAttendance } from "@/lib/types";
import { cn } from "@/lib/utils";

const fr = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
export const ordinal = (n: number, sex: string) => (n === 1 ? (sex === "FEMALE" ? "1re" : "1er") : `${n}e`);

/** Notes de l'élève par période (onglets), moyenne générale et rang. Fiche élève et espace parent. */
export function GradesSection({
  periods,
  period,
  href,
  sex,
  empty,
}: {
  periods: ReportPeriod[];
  period: ReportPeriod | undefined;
  href: (periodId: string) => string;
  sex: string;
  empty: string;
}) {
  return (
    <section className="rounded-2xl border bg-card p-5" aria-label="Notes">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Notes</h2>
        {periods.length > 1 && (
          <nav aria-label="Période" className="flex rounded-lg bg-muted p-0.5">
            {periods.map((p) => (
              <Link
                key={p.id}
                href={href(p.id)}
                scroll={false}
                aria-current={p.id === period?.id ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1 text-sm transition-colors",
                  p.id === period?.id ? "bg-background font-medium shadow-xs" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p.name}
              </Link>
            ))}
          </nav>
        )}
      </div>
      {!period ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Matière</th>
                <th className="px-3 py-2 text-right font-medium">Coef.</th>
                <th className="px-3 py-2 font-medium">Notes</th>
                <th className="px-3 py-2 text-right font-medium">Moyenne /20</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {period.subjects.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2 font-medium">{s.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fr(s.coefficient)}</td>
                  <td className="px-3 py-2">
                    {s.grades.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {s.grades.map((g) => (
                          <span
                            key={g.id}
                            title={`${g.title} · ${date(g.day)}`}
                            className="rounded-md bg-muted px-2 py-0.5 text-xs whitespace-nowrap tabular-nums"
                          >
                            {g.score === null ? "abs." : `${fr(g.score)}/${g.maxScore}`}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right font-medium tabular-nums",
                      s.average !== null && s.average < 10 && "text-destructive",
                    )}
                  >
                    {s.average === null ? "—" : fr(s.average)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t bg-muted/30 font-semibold">
              <tr>
                <td colSpan={3} className="px-3 py-2">
                  Moyenne générale
                  {period.rank !== null && (
                    <span className="ml-2 font-normal text-muted-foreground">
                      · {ordinal(period.rank, sex)} sur {period.ranked}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{period.average === null ? "—" : fr(period.average)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

/** Présences, retards, absences de l'année et les derniers manquements. */
export function AttendanceSummary({ attendance }: { attendance: StudentAttendance }) {
  return (
    <>
      <dl className="mb-4 grid grid-cols-3 gap-2 text-center">
        {(
          [
            ["Présent", attendance.present, "text-success"],
            ["Retards", attendance.late, "text-amber-600"],
            ["Absences", attendance.absent, "text-destructive"],
          ] as const
        ).map(([label, n, tone]) => (
          <div key={label} className="rounded-lg bg-muted/50 p-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className={cn("text-xl font-semibold tabular-nums", tone)}>{n}</dd>
          </div>
        ))}
      </dl>
      {attendance.recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune absence ni retard cette année.</p>
      ) : (
        <>
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">Dernières absences et retards</p>
          <ul className="divide-y rounded-lg border text-sm">
            {attendance.recent.map((r) => (
              <li key={r.day} className="flex justify-between px-3 py-2">
                <span>{date(r.day)}</span>
                <span className={r.status === "ABSENT" ? "text-destructive" : "text-amber-600"}>
                  {r.status === "ABSENT" ? "Absent" : "En retard"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
