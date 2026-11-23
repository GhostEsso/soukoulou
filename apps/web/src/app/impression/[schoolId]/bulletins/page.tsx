import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { date } from "@/lib/format";
import type { ReportCards } from "@/lib/types";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Bulletins" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const fr = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ordinal = (n: number | null, sex?: string) =>
  n === null ? "—" : n === 1 ? (sex === "FEMALE" ? "1re" : "1er") : `${n}e`;

/**
 * Bulletins imprimables d'une classe pour une période (ou d'un seul élève avec ?eleve=), un par page A4.
 * Hors du menu de l'école : la page ne contient que les bulletins. Le navigateur fait le PDF.
 */
export default async function PrintReportCards({ params, searchParams }: PageProps<"/impression/[schoolId]/bulletins">) {
  const { schoolId } = await params;
  const sp = await searchParams;
  const data = await api<ReportCards>(
    `/schools/${encodeURIComponent(schoolId)}/assessments/report-cards?classroomId=${encodeURIComponent(one(sp.classe))}&periodId=${encodeURIComponent(one(sp.periode))}`,
  ).catch((e) => {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403 || e.status === 400)) notFound();
    throw e;
  });
  const eleve = one(sp.eleve);
  const students = eleve ? data.students.filter((s) => s.id === eleve) : data.students;
  if (students.length === 0) notFound();
  const s0 = data.school;

  return (
    <div className="min-h-screen bg-neutral-100 py-6 text-neutral-900 print:bg-white print:py-0">
      <style>{`@page { size: A4; margin: 10mm; } @media print { html, body { background: #fff !important; } }`}</style>
      <div className="mx-auto mb-6 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 print:hidden">
        <p className="text-sm text-neutral-600">
          {students.length} bulletin{students.length > 1 ? "s" : ""} · {data.classroom.name} · {data.period.name}
        </p>
        <PrintButton />
      </div>

      {students.map((st) => {
        const points = st.subjects.reduce((n, s) => n + (s.points ?? 0), 0);
        const coefs = st.subjects.filter((s) => s.average !== null).reduce((n, s) => n + s.coefficient, 0);
        return (
          <article
            key={st.id}
            className="mx-auto mb-6 max-w-[210mm] break-after-page bg-white p-[10mm] text-[11px] leading-snug shadow print:mb-0 print:p-0 print:shadow-none"
          >
            <header className="grid grid-cols-3 items-start gap-4 border-b-2 border-neutral-900 pb-3">
              <div>
                <p className="text-sm font-bold uppercase">{s0.name}</p>
                <p>{[s0.address, s0.city].filter(Boolean).join(", ")}</p>
                {s0.phone && <p>Tél. {s0.phone}</p>}
                {s0.email && <p>{s0.email}</p>}
              </div>
              <div className="text-center">
                <p className="text-base font-bold tracking-wide uppercase">
                  {data.annual ? "Bulletin annuel" : "Bulletin de notes"}
                </p>
                {!data.annual && <p className="font-semibold">{data.period.name}</p>}
                <p>Année scolaire {data.year}</p>
              </div>
              {s0.country === "TG" ? (
                <div className="text-right">
                  <p className="font-bold uppercase">République togolaise</p>
                  <p className="italic">Travail – Liberté – Patrie</p>
                </div>
              ) : (
                <span />
              )}
            </header>

            <section className="my-3 grid grid-cols-2 gap-x-6 gap-y-0.5 rounded border border-neutral-400 p-2">
              <p>
                Nom et prénoms : <strong className="uppercase">{st.lastName}</strong> <strong>{st.firstName}</strong>
              </p>
              <p>
                Classe : <strong>{data.classroom.name}</strong> · Effectif : <strong>{data.stats.size}</strong>
              </p>
              <p>
                Matricule : <strong>{st.matricule ?? "—"}</strong> · Sexe : <strong>{st.sex === "FEMALE" ? "F" : "M"}</strong>
              </p>
              <p>
                {st.sex === "FEMALE" ? "Née" : "Né"} le : <strong>{st.birthDate ? date(st.birthDate) : "—"}</strong>
              </p>
            </section>

            <table className="w-full border-collapse [&_td]:border [&_td]:border-neutral-400 [&_td]:px-1.5 [&_td]:py-1 [&_th]:border [&_th]:border-neutral-400 [&_th]:px-1.5 [&_th]:py-1">
              <thead className="bg-neutral-200 text-left">
                <tr>
                  <th>Matières</th>
                  {data.periods.map((p) => (
                    <th key={p.id} className="text-right font-normal">
                      {p.name}
                    </th>
                  ))}
                  <th className="text-right">{data.annual ? "Moy. ann." : "Moy. /20"}</th>
                  <th className="text-right">Coef.</th>
                  <th className="text-right">Moy. × coef.</th>
                  <th className="text-right">Rang</th>
                  <th>Appréciation</th>
                  <th>Professeur</th>
                </tr>
              </thead>
              <tbody>
                {st.subjects.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium">{s.name}</td>
                    {s.periodAverages.map((v, i) => (
                      <td key={i} className="text-right text-neutral-600 tabular-nums">
                        {fr(v)}
                      </td>
                    ))}
                    <td className="text-right font-semibold tabular-nums">{fr(s.average)}</td>
                    <td className="text-right tabular-nums">{s.coefficient.toLocaleString("fr-FR")}</td>
                    <td className="text-right tabular-nums">{fr(s.points)}</td>
                    <td className="text-right tabular-nums">{ordinal(s.rank, st.sex)}</td>
                    <td>{s.appreciation ?? "Non noté"}</td>
                    <td>{s.teacher ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-neutral-100 font-semibold">
                <tr>
                  <td>Totaux</td>
                  {data.periods.map((p) => (
                    <td key={p.id} />
                  ))}
                  <td />
                  <td className="text-right tabular-nums">{coefs.toLocaleString("fr-FR")}</td>
                  <td className="text-right tabular-nums">{fr(points)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>

            <section className="mt-3 grid grid-cols-3 gap-3">
              <div className="rounded border-2 border-neutral-900 p-2">
                <p className="text-[10px] uppercase">{data.annual ? "Moyenne annuelle" : "Moyenne générale"}</p>
                <p className="text-xl font-bold tabular-nums">{fr(st.average)} / 20</p>
                <p>
                  Rang : <strong>{ordinal(st.rank, st.sex)}</strong> sur {data.stats.ranked}
                </p>
                {data.periods.map((p, i) => (
                  <p key={p.id} className="text-neutral-600">
                    {p.name} : <span className="tabular-nums">{fr(st.periodAverages[i])}</span>
                  </p>
                ))}
              </div>
              <div className="rounded border border-neutral-400 p-2">
                <p className="text-[10px] uppercase">Classe</p>
                <p>
                  Moyenne : <strong className="tabular-nums">{fr(data.stats.average)}</strong>
                </p>
                <p>
                  Plus forte : <strong className="tabular-nums">{fr(data.stats.max)}</strong>
                </p>
                <p>
                  Plus faible : <strong className="tabular-nums">{fr(data.stats.min)}</strong>
                </p>
              </div>
              <div className="rounded border border-neutral-400 p-2">
                <p className="text-[10px] uppercase">Assiduité</p>
                <p>
                  Absences : <strong>{st.absences}</strong> jour{st.absences > 1 ? "s" : ""}
                </p>
                <p>
                  Retards : <strong>{st.lates}</strong>
                </p>
              </div>
            </section>

            <section className="mt-3 grid grid-cols-3 gap-3">
              <div className="col-span-2 rounded border border-neutral-400 p-2">
                <p className="text-[10px] uppercase">Décision du conseil de classe</p>
                <p className="mt-1">
                  Distinction : <strong>{st.mention ?? "—"}</strong>
                </p>
                <p className="mt-1">
                  Appréciation : {st.council.comment && <strong className="font-medium">{st.council.comment}</strong>}
                </p>
                {!st.council.comment && (
                  <>
                    <div className="mt-4 border-b border-dotted border-neutral-500" />
                    <div className="mt-5 border-b border-dotted border-neutral-500" />
                  </>
                )}
                {data.annual && (
                  <p className="mt-2 text-sm">
                    Décision :{" "}
                    {st.council.decision ? (
                      <strong className="uppercase">
                        {st.council.decision === "PROMOTED"
                          ? `${st.sex === "FEMALE" ? "Admise" : "Admis"} en classe supérieure`
                          : "Redouble"}
                      </strong>
                    ) : (
                      <span className="text-neutral-500">............................................</span>
                    )}
                  </p>
                )}
              </div>
              <div className="flex flex-col justify-between rounded border border-neutral-400 p-2">
                <p className="text-[10px] uppercase">Le chef d’établissement</p>
                <p className="mt-12 text-[10px] text-neutral-500">Signature et cachet</p>
              </div>
            </section>
            <p className="mt-2 text-right text-[10px] text-neutral-500">Signature des parents : ............................................</p>
          </article>
        );
      })}
    </div>
  );
}
