import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ago, COUNTRIES, SCHOOL_TYPES, VERIFICATION } from "@/lib/format";
import type { SchoolType, VerificationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getVerifications } from "../data";

export const metadata: Metadata = { title: "Vérifications" };

const TABS: VerificationStatus[] = ["PENDING", "CHANGES_REQUESTED", "VERIFIED", "REJECTED"];

export default async function VerificationsPage({ searchParams }: PageProps<"/admin/verifications">) {
  const { statut } = await searchParams;
  const status = TABS.find((t) => t === statut) ?? "PENDING";
  const rows = await getVerifications(status);

  return (
    <>
      <PageHeader title="Vérifications" description="Les plus anciens dossiers d’abord." />

      <nav aria-label="Statut" className="mb-4 flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`?statut=${t}`}
            aria-current={t === status ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium",
              t === status ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {VERIFICATION[t].label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="size-5" aria-hidden />}
          title="Aucun dossier"
          description={status === "PENDING" ? "Tout est à jour." : "Aucune école dans cet état."}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>École</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead className="hidden sm:table-cell">Offre</TableHead>
                <TableHead className="text-right">Pièces</TableHead>
                <TableHead className="text-right">Mis à jour</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="relative">
                  <TableCell>
                    <Link href={`/admin/verifications/${r.id}`} className="font-medium after:absolute after:inset-0 hover:underline">
                      {r.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {r.city}, {COUNTRIES[r.country] ?? r.country}
                    </p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{SCHOOL_TYPES[r.type as SchoolType] ?? r.type}</TableCell>
                  <TableCell className="hidden sm:table-cell">{r.plan?.name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r._count.documents}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{ago(r.updatedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
