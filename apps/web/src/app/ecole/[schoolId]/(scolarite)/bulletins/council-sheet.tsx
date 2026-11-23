"use client";

import { Printer } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { toast } from "sonner";
import { FormMessage, SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionState } from "@/lib/api";
import type { ReportCards } from "@/lib/types";
import { cn } from "@/lib/utils";
import { saveCouncil } from "../actions";

const fr = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ordinal = (n: number, sex: string) => (n === 1 ? (sex === "FEMALE" ? "1re" : "1er") : `${n}e`);
export const DECISIONS = { PROMOTED: "Admis", REPEATING: "Redouble" } as const;

/**
 * Classement de la classe + saisie de l'avis du conseil (appréciation, et décision sur le bilan annuel).
 * La décision part de la proposition calculée (moyenne annuelle ≥ 10) tant que le conseil n'a rien enregistré.
 */
export function CouncilSheet({
  schoolId,
  data,
  readOnly,
  print,
}: {
  schoolId: string;
  data: ReportCards;
  readOnly: boolean;
  print: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(async (prev, form) => {
    const r = await saveCouncil(schoolId, data.classroom.id, data.period.id, prev, form);
    if (r?.ok) toast.success(r.message);
    return r;
  }, undefined);
  const rows = [...data.students].sort(
    (a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.lastName.localeCompare(b.lastName, "fr"),
  );
  const th = "px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap";

  // Périodes sans aucune moyenne : le bilan annuel n'est encore que provisoire.
  const empty = data.periods.filter((_, i) => data.students.every((st) => st.periodAverages[i] === null));

  return (
    <form action={action}>
      {empty.length > 0 && (
        <p className="border-t bg-amber-50 px-5 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          Bilan provisoire : pas encore de notes pour {empty.map((p) => p.name).join(", ")}. Attendez la fin de l’année
          pour valider les décisions de passage.
        </p>
      )}
      {state?.error && (
        <div className="border-t px-5 py-3">
          <FormMessage state={state} />
        </div>
      )}
      <div className="overflow-x-auto border-t">
        <table className="w-full text-sm">
          <thead className="border-b">
            <tr>
              <th className={cn(th, "pl-5")}>Rang</th>
              <th className={th}>Élève</th>
              {data.periods.map((p) => (
                <th key={p.id} className={cn(th, "text-right")}>
                  {p.name}
                </th>
              ))}
              <th className={cn(th, "text-right")}>{data.annual ? "Moy. annuelle" : "Moyenne /20"}</th>
              <th className={th}>Mention</th>
              <th className={cn(th, "text-right")}>Abs.</th>
              <th className={cn(th, "min-w-64")}>Appréciation du conseil</th>
              {data.annual && <th className={th}>Décision</th>}
              <th className={cn(th, "pr-5 text-right")}>Bulletin</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center text-muted-foreground">
                  Aucun élève inscrit en {data.classroom.name}.
                </td>
              </tr>
            ) : (
              rows.map((s) => {
                const name = `${s.lastName} ${s.firstName}`;
                const decision = s.council.decision ?? s.suggestion;
                return (
                  <tr key={s.id}>
                    <td className="py-2 pr-3 pl-5 tabular-nums">{s.rank === null ? "—" : ordinal(s.rank, s.sex)}</td>
                    <td className="px-3 py-2">
                      <Link href={`/ecole/${schoolId}/eleves/${s.id}`} className="font-medium whitespace-nowrap hover:underline">
                        {name}
                      </Link>
                    </td>
                    {s.periodAverages.map((v, i) => (
                      <td key={i} className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                        {fr(v)}
                      </td>
                    ))}
                    <td
                      className={cn(
                        "px-3 py-2 text-right font-medium tabular-nums",
                        s.average !== null && s.average < 10 && "text-destructive",
                      )}
                    >
                      {fr(s.average)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{s.mention ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.absences}</td>
                    <td className="px-3 py-1.5">
                      <Input
                        name={`c_${s.id}`}
                        defaultValue={s.council.comment ?? ""}
                        maxLength={300}
                        disabled={readOnly}
                        autoComplete="off"
                        placeholder={
                          s.average === null
                            ? "Non classé"
                            : `Ex. : ${data.annual ? "Bonne année" : "Bon trimestre"}, poursuivez vos efforts.`
                        }
                        aria-label={`Appréciation du conseil pour ${name}`}
                        className="h-8"
                      />
                    </td>
                    {data.annual && (
                      <td className="px-3 py-1.5">
                        <select
                          name={`d_${s.id}`}
                          defaultValue={decision ?? ""}
                          disabled={readOnly}
                          aria-label={`Décision pour ${name}`}
                          className={cn(
                            "h-8 rounded-md border bg-background px-2 text-sm",
                            decision === "REPEATING" && "text-destructive",
                          )}
                        >
                          <option value="">—</option>
                          <option value="PROMOTED">{DECISIONS.PROMOTED}</option>
                          <option value="REPEATING">{DECISIONS.REPEATING}</option>
                        </select>
                        {!s.council.decision && s.suggestion && (
                          <span className="ml-1.5 text-xs text-muted-foreground">proposé</span>
                        )}
                      </td>
                    )}
                    <td className="py-2 pr-5 pl-3 text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`${print}&eleve=${s.id}`} target="_blank" aria-label={`Bulletin de ${name}`}>
                          <Printer aria-hidden /> Bulletin
                        </Link>
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {!readOnly && rows.length > 0 && (
        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t bg-card/95 px-5 py-3 backdrop-blur">
          <p className="text-sm text-muted-foreground">
            {data.annual
              ? "Décision proposée : admis à partir de 10 de moyenne annuelle. Enregistrez pour la valider."
              : "Les appréciations apparaissent sur les bulletins imprimés."}
          </p>
          <SubmitButton size="default" pendingLabel="Enregistrement…">
            Enregistrer l’avis du conseil
          </SubmitButton>
        </div>
      )}
    </form>
  );
}
