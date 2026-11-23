import type { Metadata } from "next";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { getStructure } from "@/lib/data";
import { RELATIONS } from "@/lib/format";
import type { ParentPage } from "@/lib/types";
import { FilterSelect } from "../filter-select";
import { ListCard, NoResult, one, Pagination, readOnlyOf } from "../list";
import { AddParent, DeleteParent, EditParent, ParentAccess } from "./parent-actions";

export const metadata: Metadata = { title: "Parents" };

export default async function ParentsPage({ params, searchParams }: PageProps<"/ecole/[schoolId]/parents">) {
  const { schoolId } = await params;
  const sp = await searchParams;
  const q = one(sp.q);
  const classe = one(sp.classe);
  const query = new URLSearchParams({ page: String(Math.max(1, Number(one(sp.page)) || 1)) });
  if (q) query.set("q", q);
  if (classe) query.set("classroomId", classe);

  const [data, structure, readOnly] = await Promise.all([
    api<ParentPage>(`/schools/${encodeURIComponent(schoolId)}/parents?${query}`),
    getStructure(schoolId),
    readOnlyOf(schoolId),
  ]);
  const year = structure.years.find((y) => y.isCurrent) ?? structure.years[0];
  const classes = structure.classrooms.filter((c) => c.yearId === year?.id);
  const base = `/ecole/${schoolId}`;

  return (
    <ListCard
      title="Parents"
      count={data.total}
      search={{ value: q, placeholder: "Parent, enfant, téléphone…", label: "Rechercher un parent" }}
      actions={
        <>
          {classes.length > 0 && (
            <FilterSelect
              param="classe"
              value={classe}
              label="Filtrer par classe"
              allLabel="Toutes les classes"
              options={classes.map((c) => [c.id, c.name])}
            />
          )}
          {!readOnly && <AddParent schoolId={schoolId} />}
        </>
      }
      pagination={
        <Pagination page={data.page} pages={Math.max(1, Math.ceil(data.total / data.pageSize))} sp={sp} base={`${base}/parents`} />
      }
    >
      <div className="overflow-x-auto border-t">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Parent</TableHead>
              <TableHead>Enfants</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Adresse</TableHead>
              {!readOnly && <TableHead className="pr-5 text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.length === 0 ? (
              <NoResult
                colSpan={5}
                filtered={Boolean(q || classe)}
                empty="Aucun parent. Ajoutez-les avec le bouton « Ajouter » ou depuis la fiche d’un élève."
              />
            ) : (
              data.items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="pl-5">
                    <span className="block font-medium">
                      {p.lastName} {p.firstName}
                    </span>
                    <span className="block text-xs text-muted-foreground">{p.email ?? p.profession ?? "—"}</span>
                  </TableCell>
                  <TableCell>
                    {p.children.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {p.children.map((c) => (
                          <li key={c.id} className="text-sm whitespace-nowrap">
                            <Link href={`${base}/eleves/${c.id}`} className="hover:underline">
                              {c.firstName} {c.lastName}
                            </Link>
                            <span className="text-muted-foreground">
                              {" "}
                              · {RELATIONS[c.relation].toLowerCase()}
                              {c.classroom && `, ${c.classroom.name}`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    <a href={`tel:${p.phone.replace(/\s/g, "")}`} className="hover:underline">
                      {p.phone}
                    </a>
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">{p.address ?? "—"}</TableCell>
                  {!readOnly && (
                    <TableCell className="pr-5">
                      <div className="flex justify-end gap-1">
                        <ParentAccess schoolId={schoolId} parent={p} />
                        <EditParent schoolId={schoolId} parent={p} />
                        <DeleteParent schoolId={schoolId} parent={p} />
                      </div>
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
