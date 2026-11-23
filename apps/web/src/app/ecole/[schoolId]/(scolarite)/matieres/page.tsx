import type { Metadata } from "next";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getStructure } from "@/lib/data";
import { FilterSelect } from "../filter-select";
import { ListCard, matches, NoResult, one, paginate, Pagination, readOnlyOf } from "../list";
import { AddSubject, SubjectRowActions } from "./subject-actions";

export const metadata: Metadata = { title: "Matières" };

export default async function SubjectsPage({ params, searchParams }: PageProps<"/ecole/[schoolId]/matieres">) {
  const { schoolId } = await params;
  const sp = await searchParams;
  const q = one(sp.q);
  const level = one(sp.niveau);
  const [data, readOnly] = await Promise.all([getStructure(schoolId), readOnlyOf(schoolId)]);

  // Niveaux de chaque matière, avec coefficient, dans l'ordre des niveaux.
  const usage = new Map<string, { levelId: string; name: string; coefficient: number }[]>();
  for (const l of data.levels) {
    for (const s of l.subjects) {
      usage.set(s.subjectId, [...(usage.get(s.subjectId) ?? []), { levelId: l.id, name: l.name, coefficient: s.coefficient }]);
    }
  }
  const filtered = data.subjects.filter(
    (s) => matches(q, s.name, s.shortName) && (!level || usage.get(s.id)?.some((u) => u.levelId === level)),
  );
  const { rows, page, pages } = paginate(filtered, sp);

  return (
    <ListCard
      title="Matières"
      count={filtered.length}
      search={{ value: q, placeholder: "Rechercher une matière…", label: "Rechercher une matière" }}
      actions={
        <>
          {data.levels.length > 0 && (
            <FilterSelect
              param="niveau"
              value={level}
              label="Filtrer par niveau"
              allLabel="Tous les niveaux"
              options={data.levels.map((l) => [l.id, l.name])}
            />
          )}
          {!readOnly && <AddSubject schoolId={schoolId} />}
        </>
      }
      pagination={<Pagination page={page} pages={pages} sp={sp} base={`/ecole/${schoolId}/matieres`} />}
    >
      <div className="overflow-x-auto border-t">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Matière</TableHead>
              <TableHead>Abréviation</TableHead>
              <TableHead>Niveaux · coefficient</TableHead>
              {!readOnly && <TableHead className="pr-5 text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <NoResult
                colSpan={4}
                filtered={Boolean(q || level)}
                empty="Aucune matière. Ajoutez-en avec le bouton « Ajouter »."
              />
            ) : (
              rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="pl-5 font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground">{s.shortName ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {usage.get(s.id)?.map((u) => (
                        <span key={u.levelId} className="rounded-md bg-muted px-2 py-0.5 text-xs">
                          {u.name} <span className="font-semibold">×{u.coefficient}</span>
                        </span>
                      )) ?? <span className="text-sm text-muted-foreground">Aucun niveau</span>}
                    </div>
                  </TableCell>
                  {!readOnly && (
                    <TableCell className="pr-5">
                      <SubjectRowActions schoolId={schoolId} subject={s} />
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
