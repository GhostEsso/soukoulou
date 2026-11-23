import type { Metadata } from "next";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getStructure } from "@/lib/data";
import { FilterSelect } from "../filter-select";
import { ListCard, matches, NoResult, one, paginate, Pagination, readOnlyOf } from "../list";
import { AddClass, ClassRowActions } from "./classes";

export const metadata: Metadata = { title: "Classes" };

export default async function ClassesPage({ params, searchParams }: PageProps<"/ecole/[schoolId]/classes">) {
  const { schoolId } = await params;
  const sp = await searchParams;
  const q = one(sp.q);
  const level = one(sp.niveau);
  const [data, readOnly] = await Promise.all([getStructure(schoolId), readOnlyOf(schoolId)]);

  const current = data.years.find((y) => y.isCurrent) ?? data.years[0];
  // Par défaut : l'année en cours. Une année inconnue dans l'URL retombe dessus.
  const year = data.years.find((y) => y.id === one(sp.annee)) ?? current;
  const yearOptions = data.years.map((y): [string, string] => [y.id, y.isCurrent ? `${y.label} (en cours)` : y.label]);
  const levelOptions = data.levels.map((l): [string, string] => [l.id, l.name]);
  const subjectsOf = new Map(data.levels.map((l) => [l.id, l.subjects.length]));

  const filtered = data.classrooms.filter(
    (c) => c.yearId === year?.id && (!level || c.levelId === level) && matches(q, c.name, c.level.name),
  );
  const { rows, page, pages } = paginate(filtered, sp);

  return (
    <ListCard
      title={year ? `Classes ${year.label}` : "Classes"}
      count={filtered.length}
      search={{ value: q, placeholder: "Rechercher une classe…", label: "Rechercher une classe" }}
      actions={
        <>
          {data.years.length > 1 && (
            <FilterSelect param="annee" value={year?.id ?? ""} label="Année scolaire" options={yearOptions} />
          )}
          {levelOptions.length > 0 && (
            <FilterSelect param="niveau" value={level} label="Filtrer par niveau" allLabel="Tous les niveaux" options={levelOptions} />
          )}
          {!readOnly && (
            <AddClass schoolId={schoolId} years={yearOptions} levels={levelOptions} defaultYear={year?.id ?? ""} />
          )}
        </>
      }
      pagination={<Pagination page={page} pages={pages} sp={sp} base={`/ecole/${schoolId}/classes`} />}
    >
      <div className="overflow-x-auto border-t">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Classe</TableHead>
              <TableHead>Niveau</TableHead>
              <TableHead className="text-right">Matières</TableHead>
              <TableHead className="text-right">Capacité</TableHead>
              {!readOnly && <TableHead className="pr-5 text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <NoResult
                colSpan={5}
                filtered={Boolean(q || level)}
                empty={
                  !year
                    ? "Créez d’abord une année scolaire dans Années scolaires."
                    : levelOptions.length === 0
                      ? "Ajoutez d’abord vos niveaux dans Niveaux."
                      : "Aucune classe pour cette année. Ajoutez-en avec le bouton « Ajouter »."
                }
              />
            ) : (
              rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="pl-5 font-medium">{c.name}</TableCell>
                  <TableCell>{c.level.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{subjectsOf.get(c.levelId) ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.capacity ?? "—"}</TableCell>
                  {!readOnly && (
                    <TableCell className="pr-5">
                      <ClassRowActions schoolId={schoolId} classroom={c} levels={levelOptions} />
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
