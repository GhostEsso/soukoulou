import { FileText, Printer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { getStructure } from "@/lib/data";
import type { ReportCards } from "@/lib/types";
import { FilterSelect } from "../filter-select";
import { ListCard, one, readOnlyOf } from "../list";
import { CouncilSheet } from "./council-sheet";

export const metadata: Metadata = { title: "Bulletins" };

const fr = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Classement d'une classe pour une période, et impression des bulletins (un par page A4). */
export default async function ReportCardsPage({ params, searchParams }: PageProps<"/ecole/[schoolId]/bulletins">) {
  const { schoolId } = await params;
  const sp = await searchParams;
  const [structure, readOnly] = await Promise.all([getStructure(schoolId), readOnlyOf(schoolId)]);
  const year = structure.years.find((y) => y.isCurrent) ?? structure.years[0];
  const classes = structure.classrooms.filter((c) => c.yearId === year?.id);
  const classroom = classes.find((c) => c.id === one(sp.classe)) ?? classes[0];
  const periods = year?.periods ?? [];
  // Par défaut : la période en cours (ou la dernière commencée).
  const today = new Date().toISOString().slice(0, 10);
  const annual = one(sp.periode) === "annual" && periods.length > 0;
  const period = annual
    ? { id: "annual", name: "Bilan annuel" }
    : periods.find((p) => p.id === one(sp.periode)) ??
    periods.findLast((p) => p.startsOn.slice(0, 10) <= today) ??
    periods[0];

  if (!classroom || !period) {
    return (
      <EmptyState
        icon={<FileText className="size-5" aria-hidden />}
        title={classroom ? "Aucune période" : "Aucune classe"}
        description="Créez l’année scolaire, ses périodes et ses classes, puis saisissez des notes."
      />
    );
  }

  const data = await api<ReportCards>(
    `/schools/${encodeURIComponent(schoolId)}/assessments/report-cards?classroomId=${encodeURIComponent(classroom.id)}&periodId=${encodeURIComponent(period.id)}`,
  );
  const print = `/impression/${schoolId}/bulletins?classe=${classroom.id}&periode=${period.id}`;

  return (
    <ListCard
      title={`Bulletins · ${classroom.name}${annual ? " · année" : ""}`}
      count={data.students.length}
      actions={
        <>
          <FilterSelect param="classe" value={classroom.id} label="Classe" options={classes.map((c) => [c.id, c.name])} />
          <FilterSelect param="periode" value={period.id} label="Période" options={[...periods.map((p): [string, string] => [p.id, p.name]), ["annual", "Bilan annuel"]]} />
          <Button asChild className="h-10" disabled={data.stats.ranked === 0}>
            <Link href={print} target="_blank">
              <Printer aria-hidden /> Imprimer la classe
            </Link>
          </Button>
        </>
      }
    >
      <dl className="grid grid-cols-2 gap-px border-t bg-border sm:grid-cols-4">
        {(
          [
            ["Moyenne de la classe", data.stats.average],
            ["Plus forte moyenne", data.stats.max],
            ["Plus faible moyenne", data.stats.min],
          ] as const
        ).map(([label, v]) => (
          <div key={label} className="bg-card px-5 py-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{v === null ? "—" : fr(v)}</dd>
          </div>
        ))}
        <div className="bg-card px-5 py-3">
          <dt className="text-xs text-muted-foreground">Élèves classés</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {data.stats.ranked} / {data.stats.size}
          </dd>
        </div>
      </dl>
      {/* key : repart des valeurs enregistrées quand on change de classe ou de période. */}
      <CouncilSheet key={`${classroom.id}-${period.id}`} schoolId={schoolId} data={data} readOnly={readOnly} print={print} />
    </ListCard>
  );
}
