import type { Metadata } from "next";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";
import { getOnboarding, hasFeature } from "@/lib/data";
import { dateTime, money, PAYOUT_STATUS } from "@/lib/format";
import type { FeeDashboard, Payout } from "@/lib/types";
import { Panel } from "../../../dashboard";
import { PlanDenied } from "../plan-denied";
import { PayoutForm } from "./payout-form";

export const metadata: Metadata = { title: "Décaissements" };

export default async function PayoutsPage({ params }: PageProps<"/ecole/[schoolId]/frais/decaissements">) {
  const { schoolId } = await params;
  const onboarding = await getOnboarding(schoolId);
  const denied = <PlanDenied schoolId={schoolId} title="Décaissements" />;
  if (!hasFeature(onboarding, "fee_payments")) return denied;
  const base = `/schools/${encodeURIComponent(schoolId)}/fees`;
  const data = await Promise.all([api<Payout[]>(`${base}/payouts`), api<FeeDashboard>(`${base}/dashboard`)]).catch((e) => {
    if (e instanceof ApiError && e.status === 403) return null;
    throw e;
  });
  if (!data) return denied;
  const [payouts, dash] = data;
  const canRequest = onboarding.access.collect === null;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Décaissements</h1>
      <Panel title="Disponible">
        <p className="mb-4 text-2xl font-semibold tabular-nums">{money(dash.online.available)}</p>
        {canRequest ? (
          <PayoutForm schoolId={schoolId} available={dash.online.available} />
        ) : (
          <p className="text-sm text-muted-foreground">Les demandes sont indisponibles tant que votre dossier n’est pas validé et à jour.</p>
        )}
      </Panel>
      <Panel title="Historique">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Détail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Aucune demande.
                  </TableCell>
                </TableRow>
              ) : (
                payouts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{dateTime(p.createdAt)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{money(p.amount)}</TableCell>
                    <TableCell>{p.destination}</TableCell>
                    <TableCell>
                      <StatusBadge tone={PAYOUT_STATUS[p.status].tone}>{PAYOUT_STATUS[p.status].label}</StatusBadge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.status === "PAID" ? `Réf. ${p.providerRef}` : p.status === "REJECTED" ? p.rejectReason : "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </div>
  );
}
