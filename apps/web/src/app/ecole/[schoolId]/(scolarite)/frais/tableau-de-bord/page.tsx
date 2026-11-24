import type { Metadata } from "next";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";
import { feeYear, getOnboarding, getStructure, hasFeature } from "@/lib/data";
import { money } from "@/lib/format";
import type { FeeDashboard } from "@/lib/types";
import { Panel } from "../../../dashboard";
import { PlanDenied } from "../plan-denied";
import { RecentPayments } from "./recent-payments";

export const metadata: Metadata = { title: "Frais : tableau de bord" };

export default async function FeeDashboardPage({ params }: PageProps<"/ecole/[schoolId]/frais/tableau-de-bord">) {
  const { schoolId } = await params;
  const [onboarding, structure] = await Promise.all([getOnboarding(schoolId), getStructure(schoolId)]);
  const denied = <PlanDenied schoolId={schoolId} title="Tableau de bord des frais" />;
  if (!hasFeature(onboarding, "fee_tracking")) return denied;
  const year = feeYear(structure);
  const d = await api<FeeDashboard>(`/schools/${encodeURIComponent(schoolId)}/fees/dashboard${year ? `?yearId=${encodeURIComponent(year.id)}` : ""}`).catch((e) => {
    if (e instanceof ApiError && e.status === 403) return null;
    throw e;
  });
  if (!d) return denied;

  const tiles = [
    { label: "Attendu", value: d.due },
    { label: "Encaissé", value: d.collected },
    { label: "Reste à encaisser", value: d.remaining },
    { label: "En retard", value: d.overdue, alert: d.overdue > 0 },
  ];
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Frais de scolarité{year ? ` ${year.label}` : ""}</h1>
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <li key={t.label} className="rounded-2xl border bg-card p-4">
            <span className={`block text-xl font-semibold tabular-nums sm:text-2xl ${t.alert ? "text-destructive" : ""}`}>{money(t.value)}</span>
            <span className="text-sm text-muted-foreground">{t.label}</span>
          </li>
        ))}
      </ul>
      <RecentPayments schoolId={schoolId} items={d.recent} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel title="Par classe">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Classe</TableHead>
                  <TableHead className="text-right">Attendu</TableHead>
                  <TableHead className="text-right">Encaissé</TableHead>
                  <TableHead className="text-right">Reste</TableHead>
                  <TableHead className="text-right">En retard</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.byClassroom.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Aucun frais enregistré.
                    </TableCell>
                  </TableRow>
                ) : (
                  d.byClassroom.map((c) => (
                    <TableRow key={c.classroomId ?? "none"}>
                      <TableCell className="font-medium">{c.classroom ?? "Sans classe"}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(c.due)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(c.collected)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(c.remaining)}</TableCell>
                      <TableCell className={`text-right tabular-nums ${c.overdue > 0 ? "text-destructive" : ""}`}>{money(c.overdue)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Panel>
        <Panel title="En ligne">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Encaissé en ligne</dt>
              <dd className="text-lg font-semibold tabular-nums">{money(d.online.collected)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Disponible pour un décaissement</dt>
              <dd className="text-lg font-semibold tabular-nums">{money(d.online.available)}</dd>
            </div>
          </dl>
        </Panel>
      </div>
    </div>
  );
}
