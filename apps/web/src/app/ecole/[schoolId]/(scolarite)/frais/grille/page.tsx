import type { Metadata } from "next";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { feeYear, getOnboarding, getStructure, hasFeature } from "@/lib/data";
import { dayLabel, money } from "@/lib/format";
import type { FeeSchedule } from "@/lib/types";
import { ListCard, NoResult } from "../../list";
import { AddSchedule, ScheduleActions } from "../schedule-dialog";

export const metadata: Metadata = { title: "Grille des frais" };

const AUDIENCE = { MALE: "Garçons", FEMALE: "Filles" } as const;

export default async function FeeGridPage({ params }: PageProps<"/ecole/[schoolId]/frais/grille">) {
  const { schoolId } = await params;
  const [onboarding, structure] = await Promise.all([getOnboarding(schoolId), getStructure(schoolId)]);
  const year = feeYear(structure);
  const schedules = year ? await api<FeeSchedule[]>(`/schools/${encodeURIComponent(schoolId)}/fees/schedules?yearId=${encodeURIComponent(year.id)}`) : [];
  // Écriture : caisse + école non bloquée ; plusieurs tranches : suivi des frais.
  const canWrite = Boolean(year) && hasFeature(onboarding, "cashbox") && onboarding.access.write === null;
  const multi = hasFeature(onboarding, "fee_tracking");

  return (
    <ListCard
      title={year ? `Grille des frais ${year.label}` : "Grille des frais"}
      count={schedules.length}
      actions={canWrite && year && <AddSchedule schoolId={schoolId} yearId={year.id} levels={structure.levels} multi={multi} />}
    >
      <div className="overflow-x-auto border-t">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Règle</TableHead>
              <TableHead>Niveaux</TableHead>
              <TableHead>Public</TableHead>
              <TableHead>Tranches</TableHead>
              <TableHead className="text-right">Total</TableHead>
              {canWrite && <TableHead className="pr-5 text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.length === 0 ? (
              <NoResult
                colSpan={6}
                filtered={false}
                empty={year ? "Aucune règle. Ajoutez le montant de la scolarité par niveau ; le dû de chaque élève en découle à son inscription." : "Créez d’abord une année scolaire."}
              />
            ) : (
              schedules.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="pl-5 font-medium">{s.label ?? "—"}</TableCell>
                  <TableCell>{s.levels.map((l) => l.name).join(", ")}</TableCell>
                  <TableCell>{s.sex ? AUDIENCE[s.sex] : "Tous"}</TableCell>
                  <TableCell>
                    <ol className="space-y-0.5 text-sm">
                      {s.lines.map((l) => (
                        <li key={l.position} className="tabular-nums">
                          {money(l.amount)} <span className="text-muted-foreground">avant le {dayLabel(l.dueOn)}</span>
                        </li>
                      ))}
                    </ol>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{money(s.lines.reduce((n, l) => n + l.amount, 0))}</TableCell>
                  {canWrite && year && (
                    <TableCell className="pr-5">
                      <ScheduleActions schoolId={schoolId} yearId={year.id} schedule={s} levels={structure.levels} multi={multi} />
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </ListCard>
  );
}
