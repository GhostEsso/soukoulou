import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { feeYear, getStructure } from "@/lib/data";
import { money } from "@/lib/format";
import type { FeeBalance } from "@/lib/types";
import { FilterSelect } from "../filter-select";
import { ListCard, matches, NoResult, one, paginate, Pagination } from "../list";

export const metadata: Metadata = { title: "Soldes des frais" };

const STATUS: [string, string][] = [
  ["unpaid", "Reste à payer"],
  ["overdue", "En retard"],
  ["paid", "Soldé"],
];

export default async function BalancesPage({ params, searchParams }: PageProps<"/ecole/[schoolId]/frais">) {
  const { schoolId } = await params;
  const sp = await searchParams;
  const q = one(sp.q);
  const classe = one(sp.classe);
  const statut = STATUS.some(([v]) => v === one(sp.statut)) ? one(sp.statut) : "";
  const structure = await getStructure(schoolId);
  const year = feeYear(structure);

  const query = new URLSearchParams();
  if (classe) query.set("classroomId", classe);
  if (statut) query.set("status", statut);
  const all = await api<FeeBalance[]>(`/schools/${encodeURIComponent(schoolId)}/fees/students?${query}`);
  const { rows, page, pages } = paginate(
    all.filter((b) => matches(q, b.name)),
    sp,
  );
  const classes = structure.classrooms.filter((c) => c.yearId === year?.id).map((c): [string, string] => [c.id, c.name]);

  return (
    <ListCard
      title={year ? `Soldes ${year.label}` : "Soldes"}
      count={all.length}
      search={{ value: q, placeholder: "Nom de l’élève…", label: "Rechercher un élève" }}
      actions={
        <>
          {classes.length > 0 && <FilterSelect param="classe" value={classe} label="Filtrer par classe" allLabel="Toutes les classes" options={classes} />}
          <FilterSelect param="statut" value={statut} label="Filtrer par statut" allLabel="Tous les statuts" options={STATUS} />
        </>
      }
      pagination={<Pagination page={page} pages={pages} sp={sp} base={`/ecole/${schoolId}/frais`} />}
    >
      <div className="overflow-x-auto border-t">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Élève</TableHead>
              <TableHead>Classe</TableHead>
              <TableHead className="text-right">Dû</TableHead>
              <TableHead className="text-right">Payé</TableHead>
              <TableHead className="text-right">Reste</TableHead>
              <TableHead className="pr-5">Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <NoResult colSpan={6} filtered={Boolean(q || classe || statut)} empty="Aucun frais enregistré. Définissez d’abord la grille des frais." />
            ) : (
              rows.map((b) => (
                <TableRow key={b.studentId}>
                  <TableCell className="pl-5 font-medium">
                    <Link href={`/ecole/${schoolId}/frais/${b.studentId}`} className="hover:underline">
                      {b.name}
                    </Link>
                  </TableCell>
                  <TableCell>{b.classroom ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(b.due)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(b.paid)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{money(b.remaining)}</TableCell>
                  <TableCell className="pr-5">
                    {b.remaining === 0 ? (
                      <StatusBadge tone="success">Soldé</StatusBadge>
                    ) : b.overdue ? (
                      <StatusBadge tone="danger">En retard</StatusBadge>
                    ) : (
                      <StatusBadge tone="info">En cours</StatusBadge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </ListCard>
  );
}
