import { ArrowLeft, Receipt } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";
import { getOnboarding, hasFeature } from "@/lib/data";
import { dayLabel, FEE_METHODS, money } from "@/lib/format";
import type { ChildFees, StudentDetail } from "@/lib/types";
import { Panel } from "../../../dashboard";
import { CashDialog } from "../cash-dialog";

export const metadata: Metadata = { title: "Frais de l’élève" };

export default async function StudentFeePage({ params }: PageProps<"/ecole/[schoolId]/frais/[studentId]">) {
  const { schoolId, studentId } = await params;
  const base = `/schools/${encodeURIComponent(schoolId)}`;
  const gone = (e: unknown) => {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  };
  const [student, fee, onboarding] = await Promise.all([
    api<StudentDetail>(`${base}/students/${encodeURIComponent(studentId)}`).catch(gone),
    api<ChildFees | null>(`${base}/fees/students/${encodeURIComponent(studentId)}`).catch(gone),
    getOnboarding(schoolId),
  ]);
  const due = fee?.lines.reduce((n, l) => n + l.amount, 0) ?? 0;
  const paid = fee?.lines.reduce((n, l) => n + l.paid, 0) ?? 0;
  const canCash = hasFeature(onboarding, "cashbox") && onboarding.access.write === null;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/ecole/${schoolId}/frais`}>
          <ArrowLeft aria-hidden /> Soldes
        </Link>
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {student.firstName} {student.lastName}
          </h1>
          {fee && (
            <p className="text-sm text-muted-foreground">
              {fee.label} · dû {money(due)} · payé {money(paid)} · reste <strong className="text-foreground">{money(due - paid)}</strong>
            </p>
          )}
        </div>
        {fee && canCash && <CashDialog schoolId={schoolId} studentId={studentId} remaining={due - paid} />}
      </div>

      {!fee ? (
        <p className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">Aucun frais pour cet élève cette année.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Tranches">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Échéance</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead className="text-right">Payé</TableHead>
                    <TableHead className="text-right">Reste</TableHead>
                    <TableHead>
                      <span className="sr-only">Statut</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fee.lines.map((l) => (
                    <TableRow key={l.position}>
                      <TableCell>{dayLabel(l.dueOn)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(l.amount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(l.paid)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(l.remaining)}</TableCell>
                      <TableCell>
                        {l.remaining === 0 ? <StatusBadge tone="success">Soldée</StatusBadge> : l.overdue ? <StatusBadge tone="danger">En retard</StatusBadge> : <StatusBadge tone="info">À venir</StatusBadge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
          <Panel title="Paiements">
            {fee.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun paiement pour le moment.</p>
            ) : (
              <ul className="divide-y">
                {[...fee.payments].reverse().map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span>
                      <span className="block font-medium tabular-nums">{money(p.amount)}</span>
                      <span className="text-muted-foreground">
                        {FEE_METHODS[p.method]} · {dayLabel(p.paidAt)}
                      </span>
                    </span>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/impression/${schoolId}/recu/${p.id}`} target="_blank">
                        <Receipt aria-hidden /> {p.receiptNumber ?? "Reçu"}
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
