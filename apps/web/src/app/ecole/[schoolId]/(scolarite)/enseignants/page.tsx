import { Eye } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PersonAvatar } from "@/components/person-avatar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { getStructure } from "@/lib/data";
import type { TeacherPage } from "@/lib/types";
import { FilterSelect } from "../filter-select";
import { ListCard, NoResult, one, Pagination, readOnlyOf } from "../list";
import { AddTeacher, DeleteTeacher, EditTeacher } from "./teacher-actions";

export const metadata: Metadata = { title: "Enseignants" };

/** Pastilles : les 3 premières, puis « +N ». */
function Chips({ items }: { items: { id: string; name: string }[] }) {
  if (items.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.slice(0, 3).map((i) => (
        <span key={i.id} className="rounded-md bg-muted px-2 py-0.5 text-xs whitespace-nowrap">
          {i.name}
        </span>
      ))}
      {items.length > 3 && (
        <span className="rounded-md px-1 py-0.5 text-xs text-muted-foreground" title={items.slice(3).map((i) => i.name).join(", ")}>
          +{items.length - 3}
        </span>
      )}
    </div>
  );
}

export default async function TeachersPage({ params, searchParams }: PageProps<"/ecole/[schoolId]/enseignants">) {
  const { schoolId } = await params;
  const sp = await searchParams;
  const q = one(sp.q);
  const matiere = one(sp.matiere);
  const query = new URLSearchParams({ page: String(Math.max(1, Number(one(sp.page)) || 1)) });
  if (q) query.set("q", q);
  if (matiere) query.set("subjectId", matiere);

  const [data, structure, readOnly] = await Promise.all([
    api<TeacherPage>(`/schools/${encodeURIComponent(schoolId)}/teachers?${query}`),
    getStructure(schoolId),
    readOnlyOf(schoolId),
  ]);
  const base = `/ecole/${schoolId}/enseignants`;

  return (
    <ListCard
      title="Enseignants"
      count={data.total}
      search={{ value: q, placeholder: "Nom, matricule, email, téléphone…", label: "Rechercher un enseignant" }}
      actions={
        <>
          {structure.subjects.length > 0 && (
            <FilterSelect
              param="matiere"
              value={matiere}
              label="Filtrer par matière"
              allLabel="Toutes les matières"
              options={structure.subjects.map((s) => [s.id, s.name])}
            />
          )}
          {!readOnly && <AddTeacher schoolId={schoolId} />}
        </>
      }
      pagination={<Pagination page={data.page} pages={Math.max(1, Math.ceil(data.total / data.pageSize))} sp={sp} base={base} />}
    >
      <div className="overflow-x-auto border-t">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Enseignant</TableHead>
              <TableHead>Matricule</TableHead>
              <TableHead>Matières</TableHead>
              <TableHead>Classes</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Adresse</TableHead>
              <TableHead className="pr-5 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.length === 0 ? (
              <NoResult
                colSpan={7}
                filtered={Boolean(q || matiere)}
                empty="Aucun enseignant. Ajoutez-les avec le bouton « Ajouter »."
              />
            ) : (
              data.items.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="pl-5">
                    <Link href={`${base}/${t.id}`} className="group flex items-center gap-3">
                      <PersonAvatar kind="enseignants" schoolId={schoolId} person={t} className="size-9 bg-primary/10 text-xs text-primary" />
                      <span className="min-w-0">
                        <span className="block font-medium group-hover:underline">
                          {t.lastName} {t.firstName}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">{t.email ?? "—"}</span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">{t.matricule ?? "—"}</TableCell>
                  <TableCell>
                    <Chips items={t.subjects} />
                  </TableCell>
                  <TableCell>
                    <Chips items={t.classes} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{t.phone ?? "—"}</TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">{t.address ?? "—"}</TableCell>
                  <TableCell className="pr-5">
                    <div className="flex justify-end gap-1">
                      <Button asChild size="icon" variant="ghost">
                        <Link href={`${base}/${t.id}`} aria-label={`Voir la fiche de ${t.firstName} ${t.lastName}`}>
                          <Eye aria-hidden />
                        </Link>
                      </Button>
                      {!readOnly && (
                        <>
                          <EditTeacher schoolId={schoolId} teacher={t} />
                          <DeleteTeacher schoolId={schoolId} teacher={t} />
                        </>
                      )}
                    </div>
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
