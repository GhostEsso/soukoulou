import { Banknote } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dateTime, money } from "@/lib/format";
import { getPendingTransfers } from "../data";
import { ConfirmButton } from "./confirm-button";

export const metadata: Metadata = { title: "Virements à confirmer" };

export default async function PaymentsPage() {
  const rows = await getPendingTransfers();
  return (
    <>
      <PageHeader
        title="Virements à confirmer"
        description="Confirmez seulement après avoir vu le montant et la référence sur le relevé bancaire."
      />
      {rows.length === 0 ? (
        <EmptyState icon={<Banknote className="size-5" aria-hidden />} title="Aucun virement en attente" />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>École</TableHead>
                <TableHead className="hidden sm:table-cell">Offre</TableHead>
                <TableHead>Référence</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Action</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <p className="font-medium">{p.school.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.school.city} · {dateTime(p.createdAt)}
                    </p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {p.plan.name} · {p.billingCycle === "SCHOOL_YEAR" ? "année" : "mois"}
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs break-all">{p.id}</code>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{money(p.amount, p.currency)}</TableCell>
                  <TableCell className="text-right">
                    <ConfirmButton paymentId={p.id} />
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
