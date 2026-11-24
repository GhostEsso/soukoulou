import Link from "next/link";
import { SearchInput } from "@/components/search-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dateTime, FEE_METHODS, money } from "@/lib/format";
import type { FeeDashboard } from "@/lib/types";
import { Panel } from "../../../dashboard";

/** Derniers paiements : qui a payé, quand, pour quel enfant, et ce qu'il restait ensuite. */
export function RecentPayments({ schoolId, items, q }: { schoolId: string; items: FeeDashboard["recent"]; q: string }) {
  const s = encodeURIComponent(schoolId);
  return (
    <Panel title={q ? `Paiements pour « ${q} »` : "Derniers paiements"}>
      <div className="mb-4">
        <SearchInput
          defaultValue={q}
          placeholder="Nom d’un élève ou d’un parent…"
          label="Filtrer les paiements par élève ou par parent"
        />
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date et heure</TableHead>
              <TableHead>Payé par</TableHead>
              <TableHead>Enfant</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead className="text-right">Reste à payer</TableHead>
              <TableHead>Reçu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  {q ? "Aucun paiement pour cette recherche." : "Aucun paiement pour l’instant."}
                </TableCell>
              </TableRow>
            ) : (
              items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap">{p.paidAt ? dateTime(p.paidAt) : "—"}</TableCell>
                  <TableCell>
                    <span className="block font-medium">{p.payer ?? "—"}</span>
                    <span className="text-xs text-muted-foreground">{FEE_METHODS[p.method]}</span>
                  </TableCell>
                  <TableCell>
                    <Link href={`/ecole/${s}/frais/${encodeURIComponent(p.studentId)}`} className="font-medium hover:underline">
                      {p.student ?? "—"}
                    </Link>
                    {p.classroom && <span className="block text-xs text-muted-foreground">{p.classroom}</span>}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{money(p.amount)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(p.remainingAfter)}</TableCell>
                  <TableCell>
                    {p.receiptNumber ? (
                      <Link href={`/impression/${s}/recu/${encodeURIComponent(p.id)}`} className="text-sm text-primary hover:underline">
                        {p.receiptNumber}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}
