import { NotebookPen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DeleteButton } from "@/app/ecole/[schoolId]/(scolarite)/dialogs";
import { FilterSelect } from "@/app/ecole/[schoolId]/(scolarite)/filter-select";
import { ListCard, NoResult, one } from "@/app/ecole/[schoolId]/(scolarite)/list";
import { AddAssessment } from "@/app/ecole/[schoolId]/(scolarite)/notes/add-assessment";
import { EmptyState } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { getTeacherHome } from "@/lib/data";
import { date, todayISO } from "@/lib/format";
import type { Assessment } from "@/lib/types";

export const metadata: Metadata = { title: "Notes" };

const fr = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

export default async function TeacherGradesPage({ params, searchParams }: PageProps<"/prof/[schoolId]/notes">) {
  const { schoolId } = await params;
  const sp = await searchParams;
  const home = await getTeacherHome(schoolId);
  const classes = [...new Map(home.teachings.map((t) => [t.classroom.id, t.classroom])).values()];
  const classroom = classes.find((c) => c.id === one(sp.classe)) ?? classes[0];

  if (!classroom) {
    return (
      <EmptyState
        icon={<NotebookPen className="size-5" aria-hidden />}
        title="Aucune classe"
        description="L’école ne vous a pas encore confié de cours."
      />
    );
  }

  const items = await api<Assessment[]>(
    `/schools/${encodeURIComponent(schoolId)}/teacher/assessments?classroomId=${encodeURIComponent(classroom.id)}`,
  );
  const subjects = home.teachings.filter((t) => t.classroom.id === classroom.id).map((t) => [t.subject.id, t.subject.name] as [string, string]);
  const base = `/prof/${schoolId}/notes`;

  return (
    <ListCard
      title={`Notes · ${classroom.name}`}
      count={items.length}
      actions={
        <>
          {classes.length > 1 && (
            <FilterSelect param="classe" value={classroom.id} label="Classe" options={classes.map((c) => [c.id, c.name])} />
          )}
          <AddAssessment schoolId={schoolId} classroomId={classroom.id} subjects={subjects} today={todayISO()} teacher />
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
              <TableHead className="text-right">Notés</TableHead>
              <TableHead className="text-right">Moyenne /20</TableHead>
              <TableHead className="pr-5 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <NoResult colSpan={7} filtered={false} empty="Aucune évaluation : créez-en une avec le bouton « Évaluation »." />
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
                  <TableCell className="text-right tabular-nums">{a.graded}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{a.average === null ? "—" : fr(a.average)}</TableCell>
                  <TableCell className="pr-5">
                    <div className="flex justify-end">
                      <DeleteButton
                        schoolId={schoolId}
                        kind="myAssessment"
                        id={a.id}
                        label={`${a.title} (${a.subject.name})`}
                        warning="L’évaluation et toutes ses notes seront supprimées."
                      />
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
