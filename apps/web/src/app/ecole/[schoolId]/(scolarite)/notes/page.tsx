import { NotebookPen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { getStructure } from "@/lib/data";
import { date, todayISO } from "@/lib/format";
import type { Assessment } from "@/lib/types";
import { DeleteButton } from "../dialogs";
import { FilterSelect } from "../filter-select";
import { ListCard, NoResult, one, readOnlyOf } from "../list";
import { AddAssessment } from "./add-assessment";

export const metadata: Metadata = { title: "Notes" };

const fr = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

/** Évaluations d'une classe pour l'année en cours ; un clic ouvre la saisie des notes. */
export default async function GradesPage({ params, searchParams }: PageProps<"/ecole/[schoolId]/notes">) {
  const { schoolId } = await params;
  const sp = await searchParams;
  const [structure, readOnly] = await Promise.all([getStructure(schoolId), readOnlyOf(schoolId)]);
  const year = structure.years.find((y) => y.isCurrent) ?? structure.years[0];
  const classes = structure.classrooms.filter((c) => c.yearId === year?.id);
  const classroom = classes.find((c) => c.id === one(sp.classe)) ?? classes[0];

  if (!classroom) {
    return (
      <EmptyState
        icon={<NotebookPen className="size-5" aria-hidden />}
        title="Aucune classe"
        description="Créez vos classes et inscrivez vos élèves pour saisir des notes."
      />
    );
  }

  const items = await api<Assessment[]>(
    `/schools/${encodeURIComponent(schoolId)}/assessments?classroomId=${encodeURIComponent(classroom.id)}`,
  );
  const subjects = structure.levels.find((l) => l.id === classroom.levelId)?.subjects ?? [];
  const base = `/ecole/${schoolId}/notes`;

  return (
    <ListCard
      title={`Notes · ${classroom.name}`}
      count={items.length}
      actions={
        <>
          <FilterSelect param="classe" value={classroom.id} label="Classe" options={classes.map((c) => [c.id, c.name])} />
          {!readOnly && subjects.length > 0 && (
            <AddAssessment
              schoolId={schoolId}
              classroomId={classroom.id}
              subjects={subjects.map((s) => [s.subjectId, s.name])}
              today={todayISO()}
            />
          )}
        </>
      }
    >
      <div className="overflow-x-auto border-t">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Évaluation</TableHead>
              <TableHead>Matière</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Période</TableHead>
              <TableHead>Enseignant</TableHead>
              <TableHead className="text-right">Notés</TableHead>
              <TableHead className="text-right">Moyenne /20</TableHead>
              <TableHead className="pr-5 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <NoResult colSpan={8} filtered={false} empty="Aucune évaluation : créez-en une avec le bouton « Évaluation »." />
            ) : (
              items.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="pl-5">
                    <Link href={`${base}/${a.id}`} className="font-medium hover:underline">
                      {a.title}
                    </Link>
                    <span className="block text-xs text-muted-foreground">sur {a.maxScore}</span>
                  </TableCell>
                  <TableCell>{a.subject.name}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{date(a.day)}</TableCell>
                  <TableCell className="whitespace-nowrap">{a.period.name}</TableCell>
                  <TableCell className="text-muted-foreground">{a.teacher?.name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{a.graded}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{a.average === null ? "—" : fr(a.average)}</TableCell>
                  <TableCell className="pr-5">
                    <div className="flex justify-end">
                      {!readOnly && (
                        <DeleteButton
                          schoolId={schoolId}
                          kind="assessment"
                          id={a.id}
                          label={`${a.title} (${a.subject.name})`}
                          warning="L’évaluation et toutes ses notes seront supprimées."
                        />
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
