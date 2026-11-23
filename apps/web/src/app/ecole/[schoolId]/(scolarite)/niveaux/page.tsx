import type { Metadata } from "next";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getStructure } from "@/lib/data";
import { ListCard, matches, NoResult, one, readOnlyOf } from "../list";
import { AddLevel, LevelRowActions, MoveLevel } from "./levels";

export const metadata: Metadata = { title: "Niveaux" };

// ponytail: pas de pagination ici : une école a rarement plus de 15 niveaux, et l'ordre se règle sur la liste entière.
export default async function LevelsPage({ params, searchParams }: PageProps<"/ecole/[schoolId]/niveaux">) {
  const { schoolId } = await params;
  const q = one((await searchParams).q);
  const [data, readOnly] = await Promise.all([getStructure(schoolId), readOnlyOf(schoolId)]);
  const ids = data.levels.map((l) => l.id);
  const rows = data.levels.filter((l) => matches(q, l.name));
  const canMove = !readOnly && !q;

  return (
    <ListCard
      title="Niveaux"
      count={rows.length}
      search={{ value: q, placeholder: "Rechercher un niveau…", label: "Rechercher un niveau" }}
      actions={!readOnly && <AddLevel schoolId={schoolId} />}
    >
      <div className="overflow-x-auto border-t">
        <Table>
          <TableHeader>
            <TableRow>
              {canMove && (
                <TableHead className="w-20 pl-5">
                  <span className="sr-only">Ordre</span>
                </TableHead>
              )}
              <TableHead className={canMove ? "" : "pl-5"}>Niveau</TableHead>
              <TableHead>Matières · coefficient</TableHead>
              <TableHead className="text-right">Classes</TableHead>
              {!readOnly && <TableHead className="pr-5 text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <NoResult
                colSpan={5}
                filtered={Boolean(q)}
                empty="Aucun niveau. Ajoutez-les du plus petit au plus grand (ex. 6e, 5e…)."
              />
            ) : (
              rows.map((l) => (
                <TableRow key={l.id}>
                  {canMove && (
                    <TableCell className="pl-3">
                      <MoveLevel schoolId={schoolId} ids={ids} index={ids.indexOf(l.id)} name={l.name} />
                    </TableCell>
                  )}
                  <TableCell className={canMove ? "font-medium" : "pl-5 font-medium"}>{l.name}</TableCell>
                  <TableCell>
                    <div className="flex max-w-xl flex-wrap gap-1.5">
                      {l.subjects.length === 0 ? (
                        <span className="text-sm text-muted-foreground">Aucune matière</span>
                      ) : (
                        l.subjects.map((s) => (
                          <span key={s.subjectId} className="rounded-md bg-muted px-2 py-0.5 text-xs">
                            {s.name} <span className="font-semibold">×{s.coefficient}</span>
                          </span>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{l._count.classrooms}</TableCell>
                  {!readOnly && (
                    <TableCell className="pr-5">
                      <LevelRowActions schoolId={schoolId} level={l} subjects={data.subjects} />
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
