import type { Metadata } from "next";
import Link from "next/link";
import { PersonAvatar } from "@/components/person-avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { getStructure } from "@/lib/data";
import { date } from "@/lib/format";
import type { StudentPage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FilterSelect } from "../filter-select";
import { ListCard, NoResult, one, Pagination, readOnlyOf } from "../list";
import { AddStudent, StudentRowActions } from "./student-actions";

export const metadata: Metadata = { title: "Élèves" };

export default async function StudentsPage({ params, searchParams }: PageProps<"/ecole/[schoolId]/eleves">) {
  const { schoolId } = await params;
  const sp = await searchParams;
  const q = one(sp.q);
  const classe = one(sp.classe);
  const sexe = one(sp.sexe);

  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (classe) query.set("classroomId", classe);
  if (sexe === "F" || sexe === "G") query.set("sex", sexe === "F" ? "FEMALE" : "MALE");
  query.set("page", String(Math.max(1, Number(one(sp.page)) || 1)));

  const [data, structure, readOnly] = await Promise.all([
    api<StudentPage>(`/schools/${encodeURIComponent(schoolId)}/students?${query}`),
    getStructure(schoolId),
    readOnlyOf(schoolId),
  ]);
  const classes = structure.classrooms
    .filter((c) => c.yearId === data.yearId)
    .map((c): [string, string] => [c.id, c.name]);
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const year = structure.years.find((y) => y.id === data.yearId);

  return (
    <ListCard
      title={year ? `Élèves ${year.label}` : "Élèves"}
      count={data.total}
      search={{ value: q, placeholder: "Nom, prénom ou matricule…", label: "Rechercher un élève" }}
      actions={
        <>
          {classes.length > 0 && (
            <FilterSelect param="classe" value={classe} label="Filtrer par classe" allLabel="Toutes les classes" options={classes} />
          )}
          <FilterSelect
            param="sexe"
            value={sexe}
            label="Filtrer par sexe"
            allLabel="Filles et garçons"
            options={[
              ["F", "Filles"],
              ["G", "Garçons"],
            ]}
          />
          {!readOnly && <AddStudent schoolId={schoolId} classes={classes} />}
        </>
      }
      pagination={<Pagination page={data.page} pages={pages} sp={sp} base={`/ecole/${schoolId}/eleves`} />}
    >
      <div className="overflow-x-auto border-t">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Élève</TableHead>
              <TableHead>Matricule</TableHead>
              <TableHead>Sexe</TableHead>
              <TableHead>Né(e) le</TableHead>
              <TableHead>Classe</TableHead>
              {!readOnly && <TableHead className="pr-5 text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.length === 0 ? (
              <NoResult
                colSpan={6}
                filtered={Boolean(q || classe || sexe)}
                empty="Aucun élève inscrit. Inscrivez-les avec le bouton « Inscrire »."
              />
            ) : (
              data.items.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="pl-5">
                    <div className="flex items-center gap-3">
                      <PersonAvatar
                        kind="eleves"
                        schoolId={schoolId}
                        person={s}
                        className={cn("size-8 text-xs", s.sex === "FEMALE" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800")}
                      />
                      <Link href={`/ecole/${schoolId}/eleves/${s.id}`} className="font-medium hover:underline">
                        {s.lastName} {s.firstName}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">{s.matricule ?? "—"}</TableCell>
                  <TableCell>{s.sex === "FEMALE" ? "Fille" : "Garçon"}</TableCell>
                  <TableCell className="text-muted-foreground">{s.birthDate ? date(s.birthDate) : "—"}</TableCell>
                  <TableCell>{s.classroom?.name ?? <span className="text-muted-foreground">Non inscrit</span>}</TableCell>
                  {!readOnly && (
                    <TableCell className="pr-5">
                      <StudentRowActions schoolId={schoolId} student={s} classes={classes} />
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
