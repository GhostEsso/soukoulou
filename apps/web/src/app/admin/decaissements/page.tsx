import { Landmark } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dateTime, money } from "@/lib/format";
import { getPendingPayouts } from "../data";
import { PayoutActions } from "./payout-actions";

export const metadata: Metadata = { title: "Décaissements" };

export default async function PayoutsPage() {
  const rows = await getPendingPayouts();
  return (
    <>
      <PageHeader
        title="Décaissements"
        description="Demandes des écoles. Versez le montant depuis le compte de collecte, puis marquez-le payé avec la référence."
      />
      {rows.length === 0 ? (
        <EmptyState icon={<Landmark className="size-5" aria-hidden />} title="Aucune demande en attente" />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>École</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <p className="font-medium">{p.school?.name}</p>
                    <p className="text-xs text-muted-foreground">{dateTime(p.createdAt)}</p>
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs break-all">{p.destination}</code>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{money(p.amount)}</TableCell>
                  <TableCell>
                    <PayoutActions payoutId={p.id} amount={money(p.amount)} school={p.school?.name ?? ""} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
